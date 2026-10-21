from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Category, Product
from .views import ProductViewSet


class ProductAPITests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Tea")
        self.other = Category.objects.create(name="Coffee")
        self.inactive = Category.objects.create(name="Disabled", status="INACTIVE")
        self.product = Product.objects.create(
            category=self.category, name="Green tea", price=Decimal("20.10"), stock_quantity=5
        )
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")
        self.list_url = reverse("product-list")
        self.detail_url = reverse("product-detail", args=[self.product.pk])
        self.status_url = reverse("product-change-status", args=[self.product.pk])
        self.payload = {"category": self.category.pk, "name": "Milk tea", "price": "30.25", "stock_quantity": 8}

    def test_public_list_and_detail(self):
        self.assertEqual(self.list_url, "/api/products")
        self.assertEqual(self.detail_url, f"/api/products/{self.product.pk}")
        self.assertEqual(self.status_url, f"{self.detail_url}/status")
        Product.objects.create(category=self.other, name="Coffee", price="10.00", status="INACTIVE")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {
            "id": self.product.pk, "category": self.category.pk, "name": "Green tea",
            "description": "", "price": "20.10", "stock_quantity": 5, "image_url": "", "status": "ACTIVE",
        })

    def test_admin_create_and_update(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.list_url, {**self.payload, "name": "  Milk tea  "}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Milk tea")
        self.assertEqual(response.data["status"], "ACTIVE")
        created = Product.objects.get(pk=response.data["id"])
        self.assertEqual(created.price, Decimal("30.25"))
        self.assertIsInstance(created.price, Decimal)
        response = self.client.put(self.detail_url, {
            **self.payload, "category": self.other.pk, "description": "Updated",
            "image_url": "https://example.com/tea.jpg", "status": "INACTIVE", "id": 999999,
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.category_id, self.other.pk)
        self.assertEqual(self.product.price, Decimal("30.25"))
        self.assertEqual(self.product.stock_quantity, 8)
        self.assertEqual(self.product.description, "Updated")
        self.assertEqual(response.data["id"], self.product.pk)

    def test_only_active_admin_can_write(self):
        users = [None]
        for index, attrs in enumerate([
            {"role": "CUSTOMER"}, {"role": "CUSTOMER", "is_staff": True},
            {"role": "CUSTOMER", "is_superuser": True},
            {"role": "ADMIN", "status": "INACTIVE"}, {"role": "ADMIN", "is_active": False},
        ]):
            users.append(get_user_model().objects.create(email=f"user{index}@example.com", **attrs))
        for user in users:
            self.client.force_authenticate(user)
            for method, url, data in (
                (self.client.post, self.list_url, self.payload),
                (self.client.put, self.detail_url, self.payload),
                (self.client.patch, self.status_url, {"status": "INACTIVE"}),
            ):
                with self.subTest(user=user, url=url):
                    self.assertEqual(method(url, data, format="json").status_code, 403)
        self.assertEqual(Product.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.name, "Green tea")
        self.assertEqual(self.product.status, "ACTIVE")

    def test_invalid_fields_on_create_and_update(self):
        self.client.force_authenticate(self.admin)
        invalid = {
            "name": ["", " \t\n ", None, "x" * 151],
            "price": ["-0.01", "abc", None, "1.001", "10000000000.00", "NaN", "Infinity"],
            "stock_quantity": [-1, "abc", None, "1.5"],
            "category": [999999, None, self.inactive.pk],
            "status": ["DELETED", "active", "", None],
        }
        for field, values in invalid.items():
            for value in values:
                for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
                    with self.subTest(field=field, value=value, url=url):
                        response = method(url, {**self.payload, field: value}, format="json")
                        self.assertEqual(response.status_code, 400)
                        self.assertIn(field, response.data)
        self.assertEqual(Product.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.price, Decimal("20.10"))

    def test_required_fields(self):
        self.client.force_authenticate(self.admin)
        for field in ("name", "price", "category"):
            payload = self.payload.copy()
            del payload[field]
            for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
                with self.subTest(field=field, url=url):
                    response = method(url, payload, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertIn(field, response.data)

    def test_zero_price_and_stock_are_valid(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.list_url, {**self.payload, "price": "0.00", "stock_quantity": 0}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["price"], "0.00")
        self.assertEqual(response.data["stock_quantity"], 0)

    def test_stock_integer_boundaries_on_create_and_update(self):
        self.client.force_authenticate(self.admin)
        for value in (0, 2147483647):
            with self.subTest(value=value):
                response = self.client.post(self.list_url, {**self.payload, "stock_quantity": value}, format="json")
                self.assertEqual(response.status_code, 201)
                self.assertEqual(Product.objects.get(pk=response.data["id"]).stock_quantity, value)
                response = self.client.put(self.detail_url, {**self.payload, "stock_quantity": value}, format="json")
                self.assertEqual(response.status_code, 200)
                self.product.refresh_from_db()
                self.assertEqual(self.product.stock_quantity, value)

    def test_stock_outside_mysql_integer_range_returns_400_without_writes(self):
        self.client.force_authenticate(self.admin)
        for value in (-1, 2147483648, "2147483648", 10 ** 30):
            for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
                with self.subTest(value=value, url=url):
                    response = method(url, {**self.payload, "stock_quantity": value}, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("stock_quantity", response.data)
        self.assertEqual(Product.objects.count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity, 5)
        self.assertEqual(self.product.name, "Green tea")

    def test_existing_inactive_category_can_be_kept(self):
        self.category.status = "INACTIVE"
        self.category.save(update_fields=["status"])
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.put(self.detail_url, self.payload, format="json").status_code, 200)
        self.assertEqual(self.client.post(self.list_url, self.payload, format="json").status_code, 400)
        self.assertEqual(self.client.put(self.detail_url, {**self.payload, "category": self.other.pk}, format="json").status_code, 200)

    def test_filter_search_and_ordering(self):
        self.client.force_authenticate(self.admin)
        cheap = Product.objects.create(category=self.category, name="Black tea", price="5.00", status="INACTIVE")
        coffee = Product.objects.create(category=self.other, name="Coffee", price="10.00")
        cases = [
            ({"category_id": self.category.pk}, [self.product.pk, cheap.pk]),
            ({"status": "INACTIVE"}, [cheap.pk]),
            ({"search": "TEA"}, [self.product.pk, cheap.pk]),
            ({"ordering": "price"}, [cheap.pk, coffee.pk, self.product.pk]),
            ({"ordering": "-price"}, [self.product.pk, coffee.pk, cheap.pk]),
            ({"category_id": self.category.pk, "status": "ACTIVE", "search": "tea", "ordering": "price"}, [self.product.pk]),
            ({"category_id": 999999}, []),
            ({"search": "missing"}, []),
        ]
        for params, expected in cases:
            with self.subTest(params=params):
                response = self.client.get(self.list_url, params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual([row["id"] for row in response.data], expected)

    def test_invalid_query_parameters(self):
        for params in ({"category_id": "abc"}, {"category_id": "-1"}, {"category_id": "9" * 100},
                       {"status": "DELETED"}, {"ordering": "name"}):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(self.list_url, params).status_code, 400)

    def test_status_endpoint_changes_only_status(self):
        self.client.force_authenticate(self.admin)
        for value in ("INACTIVE", "ACTIVE"):
            response = self.client.patch(self.status_url, {"status": value, "name": "Ignored", "price": "0.00"}, format="json")
            self.assertEqual(response.status_code, 200)
            self.product.refresh_from_db()
            self.assertEqual(self.product.status, value)
            self.assertEqual(self.product.name, "Green tea")
            self.assertEqual(self.product.price, Decimal("20.10"))
        for payload in ({}, {"status": None}, {"status": ""}, {"status": "DELETED"}):
            self.assertEqual(self.client.patch(self.status_url, payload, format="json").status_code, 400)

    def test_delete_and_regular_patch_blocked(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(self.detail_url).status_code, 405)
        self.assertEqual(self.client.patch(self.detail_url, {"name": "Changed"}, format="json").status_code, 405)
        self.assertTrue(Product.objects.filter(pk=self.product.pk, name="Green tea").exists())

    def test_missing_product(self):
        self.client.force_authenticate(self.admin)
        url = reverse("product-detail", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.put(url, self.payload, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"{url}/status", {"status": "ACTIVE"}, format="json").status_code, 404)

    def test_category_relation_is_loaded_in_one_query(self):
        Product.objects.create(category=self.other, name="Coffee", price="10.00")
        with self.assertNumQueries(1):
            products = list(ProductViewSet.queryset.all())
            self.assertEqual([product.category.name for product in products], ["Tea", "Coffee"])
        with self.assertNumQueries(1):
            self.assertEqual(self.client.get(self.list_url).status_code, 200)
