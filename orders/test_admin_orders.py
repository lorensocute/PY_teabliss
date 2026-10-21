from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import resolve, reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from products.models import Category, Product
from .models import Order, OrderItem


class AdminOrderAPITests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")
        self.customer = get_user_model().objects.create(email="customer@example.com", password="sensitive-hash")
        category = Category.objects.create(name="Tea")
        self.product = Product.objects.create(category=category, name="Green tea", price="20.00")
        self.order = self.create_order()
        self.list_url = reverse("admin-order-list")
        self.detail_url = reverse("admin-order-detail", args=[self.order.pk])
        self.status_url = reverse("admin-order-change-status", args=[self.order.pk])
        self.client.force_authenticate(self.admin)

    def create_order(self, **kwargs):
        order = Order.objects.create(user=self.customer, subtotal="40.00", total_amount="35.00",
                                     discount_amount="5.00", receiver_name="Customer", receiver_phone="123",
                                     shipping_address="Tea Street", **kwargs)
        OrderItem.objects.create(order=order, product=self.product, quantity=2, price="20.00")
        return order

    def test_routes(self):
        self.assertEqual(self.list_url, "/api/admin/orders")
        self.assertEqual(self.detail_url, f"/api/admin/orders/{self.order.pk}")
        self.assertEqual(self.status_url, f"{self.detail_url}/status")
        for path, name in ((self.list_url, "admin-order-list"), (self.status_url, "admin-order-change-status"),
                           ("/admin/", "index"), ("/api/categories", "category-list"),
                           ("/api/products", "product-list"), ("/api/promotions", "promotion-list"),
                           ("/api/admin/users", "admin-user-list")):
            self.assertEqual(resolve(path).url_name, name)

    def test_list_latest_first_and_detail(self):
        newer = self.create_order()
        Order.objects.filter(pk=self.order.pk).update(created_at=timezone.now() - timedelta(days=1))
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [newer.pk, self.order.pk])
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["customer_email"], self.customer.email)
        self.assertEqual(response.data["total_amount"], "35.00")
        self.assertEqual(response.data["items"][0]["product_name"], "Green tea")
        self.assertEqual(response.data["items"][0]["quantity"], 2)
        self.assertEqual(response.data["items"][0]["price"], "20.00")
        self.assertNotIn("password", response.content.decode())
        self.assertNotIn("sensitive-hash", response.content.decode())
        self.assertNotIn("token", response.data)

    def test_filters_and_search(self):
        other = self.create_order(status="CONFIRMED")
        for params, expected in (({"status": "PENDING"}, [self.order.pk]),
                                 ({"search": str(other.pk)}, [other.pk]),
                                 ({"search": "CUSTOMER@", "status": "CONFIRMED"}, [other.pk]),
                                 ({"search": "missing"}, []), ({"search": "9" * 100}, [])):
            response = self.client.get(self.list_url, params)
            self.assertEqual(response.status_code, 200)
            self.assertEqual([row["id"] for row in response.data], expected)
        self.assertEqual(self.client.get(self.list_url, {"status": "INVALID"}).status_code, 400)

    def test_only_active_admin(self):
        users = [None, self.customer]
        for index, attrs in enumerate([{"role": "ADMIN", "status": "INACTIVE"},
                                       {"role": "ADMIN", "is_active": False},
                                       {"role": "CUSTOMER", "is_superuser": True}]):
            users.append(get_user_model().objects.create(email=f"user{index}@example.com", **attrs))
        for user in users:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.list_url).status_code, 403)
            self.assertEqual(self.client.get(self.detail_url).status_code, 403)
            self.assertEqual(self.client.patch(self.status_url, {"status": "CONFIRMED"}, format="json").status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "PENDING")

    def test_transition_matrix_including_terminal_states(self):
        allowed = {"PENDING": {"CONFIRMED", "CANCELLED"}, "CONFIRMED": {"SHIPPING", "CANCELLED"},
                   "SHIPPING": {"COMPLETED"}, "COMPLETED": set(), "CANCELLED": set()}
        for current in allowed:
            for target in allowed:
                with self.subTest(current=current, target=target):
                    Order.objects.filter(pk=self.order.pk).update(status=current)
                    response = self.client.patch(self.status_url, {"status": target}, format="json")
                    valid = target in allowed[current]
                    self.assertEqual(response.status_code, 200 if valid else 400)
                    self.order.refresh_from_db()
                    self.assertEqual(self.order.status, target if valid else current)
                    self.assertEqual(self.order.total_amount, Decimal("35.00"))
                    self.assertEqual(self.order.user_id, self.customer.pk)
                    self.assertEqual(self.order.items.get().price, Decimal("20.00"))

    def test_status_payload_rejects_other_updates(self):
        for payload in ({}, {"status": None}, {"status": "INVALID"}, {"status": "confirmed"},
                        {"status": "CONFIRMED", "total_amount": "0"},
                        {"status": "CONFIRMED", "items": []}, {"status": "CONFIRMED", "user": self.admin.pk},
                        {"status": "CONFIRMED", "shipping_address": "Changed"}):
            self.assertEqual(self.client.patch(self.status_url, payload, format="json").status_code, 400)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, "PENDING")
        self.assertEqual(self.order.shipping_address, "Tea Street")

    def test_unsupported_methods(self):
        self.assertEqual(self.client.delete(self.detail_url).status_code, 405)
        self.assertEqual(self.client.put(self.detail_url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(self.detail_url, {"status": "CONFIRMED"}, format="json").status_code, 405)
        self.assertEqual(self.client.post(self.list_url, {}, format="json").status_code, 405)
        self.assertTrue(Order.objects.filter(pk=self.order.pk).exists())

    def test_missing_order(self):
        url = reverse("admin-order-detail", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(f"{url}/status", {"status": "CONFIRMED"}, format="json").status_code, 404)

    def test_queries_do_not_grow_with_orders_and_items(self):
        for _ in range(3):
            order = self.create_order()
            OrderItem.objects.create(order=order, product=self.product, quantity=1, price="20.00")
        with self.assertNumQueries(2):
            response = self.client.get(self.list_url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.data), 4)
        with self.assertNumQueries(2):
            self.assertEqual(self.client.get(self.detail_url).status_code, 200)
