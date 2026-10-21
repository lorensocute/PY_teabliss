from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from products.models import Category, Product
from .models import Order, OrderItem
from .statistics_expressions import RevenuePeriod


class StatisticsAPITests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")
        self.customer = get_user_model().objects.create(email="customer@example.com")
        self.client.force_authenticate(self.admin)
        self.urls = {name: reverse(f"statistics-{name}") for name in ("overview", "revenue", "orders", "products")}

    def seed(self):
        category = Category.objects.create(name="Tea")
        self.tea = Product.objects.create(category=category, name="Tea", price="100.00")
        self.coffee = Product.objects.create(category=category, name="Coffee", price="10.00")
        self.order("COMPLETED", "10.10", "2026-01-01", [(self.tea, 2), (self.coffee, 1)])
        self.order("COMPLETED", "20.20", "2026-01-01", [(self.tea, 3)])
        self.order("COMPLETED", "5.05", "2026-02-01", [(self.coffee, 7)])
        self.order("CANCELLED", "900.00", "2026-01-01", [(self.tea, 100)])
        self.order("PENDING", "800.00", "2026-01-01", [(self.tea, 100)])

    def order(self, status, total, date, items):
        order = Order.objects.create(user=self.customer, status=status, subtotal="1000.00", total_amount=total,
                                     receiver_name="Customer", receiver_phone="123", shipping_address="Street")
        timestamp = datetime.fromisoformat(date).replace(tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
        Order.objects.filter(pk=order.pk).update(created_at=timestamp)
        for product, quantity in items:
            OrderItem.objects.create(order=order, product=product, quantity=quantity, price="10.00")
        return order

    def test_permissions(self):
        users = [None, self.customer]
        for index, attrs in enumerate([{"role": "ADMIN", "status": "INACTIVE"}, {"role": "ADMIN", "is_active": False},
                                       {"role": "CUSTOMER", "is_superuser": True}]):
            users.append(get_user_model().objects.create(email=f"user{index}@example.com", **attrs))
        for user in users:
            self.client.force_authenticate(user)
            for url in self.urls.values():
                self.assertEqual(self.client.get(url).status_code, 403)

    def test_overview_excludes_cancelled_and_pending_revenue(self):
        self.seed()
        with self.assertNumQueries(3):
            response = self.client.get(self.urls["overview"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"total_revenue": "35.35", "order_count": 5, "customer_count": 1, "product_count": 2})

    def test_daily_and_monthly_revenue(self):
        self.seed()
        for group, periods in (("day", ["2026-01-01", "2026-02-01"]), ("month", ["2026-01", "2026-02"])):
            with self.assertNumQueries(1):
                response = self.client.get(self.urls["revenue"], {"group_by": group})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["results"], [
                {"period": periods[0], "revenue": "30.30", "order_count": 2},
                {"period": periods[1], "revenue": "5.05", "order_count": 1},
            ])

    def test_date_filters_inclusive_and_timezone(self):
        self.seed()
        params = {"start_date": "2026-01-01", "end_date": "2026-01-01"}
        self.assertEqual(self.client.get(self.urls["overview"], params).data["total_revenue"], "30.30")
        self.assertEqual(self.client.get(self.urls["revenue"], params).data["results"][0]["order_count"], 2)
        self.assertEqual(self.client.get(self.urls["products"], params).data["results"][0]["quantity_sold"], 5)
        self.assertEqual(sum(row["count"] for row in self.client.get(self.urls["orders"], params).data["results"]), 4)
        self.assertEqual(self.client.get(self.urls["overview"], {"start_date": "2026-02-01"}).data["total_revenue"], "5.05")
        self.assertEqual(self.client.get(self.urls["overview"], {"end_date": "2025-12-31"}).data["order_count"], 0)

    def test_status_counts(self):
        self.seed()
        with self.assertNumQueries(1):
            response = self.client.get(self.urls["orders"])
        self.assertEqual({row["status"]: row["count"] for row in response.data["results"]},
                         {"PENDING": 1, "CONFIRMED": 0, "SHIPPING": 0, "COMPLETED": 3, "CANCELLED": 1})

    def test_best_selling_completed_only_and_limit(self):
        self.seed()
        with self.assertNumQueries(1):
            response = self.client.get(self.urls["products"])
        self.assertEqual(response.data["results"], [
            {"product_id": self.coffee.pk, "name": "Coffee", "quantity_sold": 8},
            {"product_id": self.tea.pk, "name": "Tea", "quantity_sold": 5},
        ])
        self.assertEqual(len(self.client.get(self.urls["products"], {"limit": 1}).data["results"]), 1)

    def test_empty_data(self):
        self.assertEqual(self.client.get(self.urls["overview"]).data,
                         {"total_revenue": "0.00", "order_count": 0, "customer_count": 1, "product_count": 0})
        for name in ("revenue", "products"):
            self.assertEqual(self.client.get(self.urls[name]).data["results"], [])
        self.assertTrue(all(row["count"] == 0 for row in self.client.get(self.urls["orders"]).data["results"]))

    def test_invalid_parameters(self):
        for params in ({"start_date": "invalid"}, {"end_date": "2026-02-30"},
                       {"start_date": "2026-02-01", "end_date": "2026-01-01"},
                       {"end_date": "9999-12-31"}, {"group_by": "year"}, {"limit": 0}, {"limit": 101}, {"limit": "abc"}):
            for url in self.urls.values():
                with self.subTest(params=params, url=url):
                    self.assertEqual(self.client.get(url, params).status_code, 400)

    def test_read_only_and_paths(self):
        for name, url in self.urls.items():
            self.assertEqual(url, f"/api/admin/statistics/{name}")
            for method in (self.client.post, self.client.put, self.client.patch, self.client.delete):
                self.assertEqual(method(url, {}, format="json").status_code, 405)

    def test_revenue_bucket_limit(self):
        start = datetime(2024, 1, 1, tzinfo=ZoneInfo("Asia/Ho_Chi_Minh"))
        for offset in range(367):
            self.order("COMPLETED", "1.00", (start + timedelta(days=offset)).date().isoformat(), [])
        response = self.client.get(self.urls["revenue"])
        self.assertTrue(response.data["truncated"])
        self.assertEqual(len(response.data["results"]), 366)
        self.assertEqual(response.data["results"][0]["period"], "2024-01-02")

    def test_revenue_local_midnight_and_month_boundary(self):
        for timestamp, total in (("2026-01-31T16:59:59+00:00", "1.00"),
                                 ("2026-01-31T17:00:00+00:00", "2.00"),
                                 ("2026-01-31T23:00:00+00:00", "3.00")):
            order = self.order("COMPLETED", total, "2026-01-01", [])
            Order.objects.filter(pk=order.pk).update(created_at=datetime.fromisoformat(timestamp))
        for group, periods in (("day", ["2026-01-31", "2026-02-01"]), ("month", ["2026-01", "2026-02"])):
            response = self.client.get(self.urls["revenue"], {"group_by": group})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["results"], [
                {"period": periods[0], "revenue": "1.00", "order_count": 1},
                {"period": periods[1], "revenue": "5.00", "order_count": 2},
            ])
        response = self.client.get(self.urls["revenue"], {"start_date": "2026-02-01", "end_date": "2026-02-01"})
        self.assertEqual(response.data["results"], [{"period": "2026-02-01", "revenue": "5.00", "order_count": 2}])

    def test_mysql_sql_uses_numeric_offsets_once_without_timezone_tables(self):
        from django.db import connection

        for group in ("day", "month"):
            query = Order.objects.annotate(period=RevenuePeriod("created_at", group)).query
            compiler = query.get_compiler(connection=connection)
            with patch.object(connection, "vendor", "mysql"):
                sql, params = compiler.compile(query.annotations["period"])
            self.assertEqual(sql.count("CONVERT_TZ("), 1)
            self.assertEqual(params[:2], ("+00:00", "+07:00"))
            self.assertNotIn("Asia/Ho_Chi_Minh", params)
            self.assertNotIn("UTC", params)
