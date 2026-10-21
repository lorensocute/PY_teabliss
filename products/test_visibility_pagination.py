from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from orders.models import Order
from promotions.models import Promotion
from .models import Category, Product


class VisibilityTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")
        self.customer = get_user_model().objects.create(email="customer@example.com")
        self.active = Category.objects.create(name="Active")
        self.inactive = Category.objects.create(name="Inactive", status="INACTIVE")
        self.visible = Product.objects.create(category=self.active, name="Visible", price="1")
        self.disabled = Product.objects.create(category=self.active, name="Disabled", price="1", status="INACTIVE")
        self.hidden = Product.objects.create(category=self.inactive, name="Hidden", price="1")

    def test_non_admin_list_detail_and_filters_cannot_expose_inactive(self):
        inactive_admin = get_user_model().objects.create(email="inactive@example.com", role="ADMIN", status="INACTIVE")
        disabled_admin = get_user_model().objects.create(email="disabled@example.com", role="ADMIN", is_active=False)
        for user in (None, self.customer, inactive_admin, disabled_admin):
            self.client.force_authenticate(user)
            self.assertEqual([row["id"] for row in self.client.get("/api/categories").data], [self.active.pk])
            self.assertEqual([row["id"] for row in self.client.get("/api/products").data], [self.visible.pk])
            self.assertEqual(self.client.get(f"/api/categories/{self.inactive.pk}").status_code, 404)
            for product in (self.disabled, self.hidden):
                self.assertEqual(self.client.get(f"/api/products/{product.pk}").status_code, 404)
            self.assertEqual(self.client.get("/api/products", {"status": "INACTIVE"}).data, [])
            self.assertEqual(self.client.get("/api/products", {"category_id": self.inactive.pk}).data, [])
            self.assertEqual(self.client.get("/api/products", {"page": 1}).data["count"], 1)

    def test_active_admin_can_manage_all(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(len(self.client.get("/api/categories").data), 2)
        self.assertEqual(len(self.client.get("/api/products").data), 3)
        self.assertEqual(self.client.get(f"/api/categories/{self.inactive.pk}").status_code, 200)
        for product in (self.disabled, self.hidden):
            self.assertEqual(self.client.get(f"/api/products/{product.pk}").status_code, 200)
        response = self.client.get("/api/products", {"status": "INACTIVE", "page": 1})
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], self.disabled.pk)


class OptionalPaginationTests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")
        self.client.force_authenticate(self.admin)
        now = timezone.now()
        category = Category.objects.create(name="Base")
        for index in range(24):
            Category.objects.create(name=f"Category {index}")
            Product.objects.create(category=category, name=f"Product {index}", price="1")
            Promotion.objects.create(code=f"CODE{index}", discount_type="FIXED", discount_value="1",
                                     start_date=now, end_date=now + timedelta(days=1))
            get_user_model().objects.create(email=f"user{index}@example.com")
            Order.objects.create(user=self.admin, subtotal="1", total_amount="1", receiver_name="Name",
                                 receiver_phone="123", shipping_address="Street")
        self.urls = ["/api/categories", "/api/products", "/api/promotions", "/api/admin/users", "/api/admin/orders"]

    def test_legacy_arrays_and_optional_pages_for_all_lists(self):
        for url in self.urls:
            with self.subTest(url=url):
                legacy = self.client.get(url)
                self.assertEqual(legacy.status_code, 200)
                self.assertIsInstance(legacy.data, list)
                first = self.client.get(url, {"page": 1})
                self.assertEqual(first.status_code, 200)
                self.assertEqual(set(first.data), {"count", "next", "previous", "results"})
                self.assertEqual(first.data["count"], len(legacy.data))
                self.assertEqual(first.data["results"], legacy.data[:20])
                self.assertIsNone(first.data["previous"])
                self.assertIsNotNone(first.data["next"])
                second = self.client.get(url, {"page": 2})
                self.assertEqual(second.data["results"], legacy.data[20:])
                self.assertIsNone(second.data["next"])
                self.assertIsNotNone(second.data["previous"])
                self.assertEqual(len(self.client.get(url, {"page_size": 3}).data["results"]), 3)
                self.assertEqual(len(self.client.get(url, {"page_size": 100}).data["results"]), len(legacy.data))

    def test_invalid_pagination_parameters(self):
        for url in self.urls:
            for params in ({"page": ""}, {"page": "abc"}, {"page": 0}, {"page": -1}, {"page": "1.5"},
                           {"page": "last"}, {"page_size": ""}, {"page_size": 0}, {"page_size": 101},
                           {"page_size": "1.5"}, {"page": "9" * 100}):
                with self.subTest(url=url, params=params):
                    self.assertEqual(self.client.get(url, params).status_code, 400)
            self.assertEqual(self.client.get(url, {"page": 999}).status_code, 404)

    def test_empty_page_and_filter_links(self):
        response = self.client.get("/api/products", {"page": 1, "search": "missing"})
        self.assertEqual(response.data, {"count": 0, "next": None, "previous": None, "results": []})
        response = self.client.get("/api/products", {"page": 1, "page_size": 2, "search": "Product", "ordering": "price"})
        self.assertEqual(response.data["count"], 24)
        self.assertIn("search=Product", response.data["next"])
        self.assertIn("ordering=price", response.data["next"])
