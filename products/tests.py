from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient

from .models import Category, Product


class CategoryAPITests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name="Tea", description="Tea drinks")
        self.list_url = reverse("category-list")
        self.detail_url = reverse("category-detail", args=[self.category.pk])
        self.status_url = reverse("category-change-status", args=[self.category.pk])
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")

    def test_routes_and_public_reads(self):
        self.assertEqual(self.list_url, "/api/categories")
        self.assertEqual(self.detail_url, f"/api/categories/{self.category.pk}")
        self.assertEqual(self.status_url, f"{self.detail_url}/status")
        inactive = Category.objects.create(name="Coffee", status="INACTIVE")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.category.pk])
        self.assertEqual(self.client.get(self.detail_url).data["name"], "Tea")
        self.assertEqual(self.client.get(reverse("category-detail", args=[inactive.pk])).status_code, 404)

    def test_admin_create_and_update(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(self.list_url, {"name": "  Milk tea  "}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "Milk tea")
        self.assertEqual(response.data["status"], "ACTIVE")
        response = self.client.put(self.detail_url, {
            "id": 999, "name": "Green tea", "description": "Updated", "status": "INACTIVE"
        }, format="json")
        self.assertEqual(response.status_code, 200)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name, "Green tea")
        self.assertEqual(self.category.description, "Updated")
        self.assertEqual(self.category.status, "INACTIVE")
        self.assertEqual(response.data["id"], self.category.pk)

    def test_invalid_names(self):
        self.client.force_authenticate(self.admin)
        for payload in ({}, {"name": ""}, {"name": " \t\n "}, {"name": None}, {"name": "x" * 101}):
            for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
                with self.subTest(payload=payload, url=url):
                    response = method(url, payload, format="json")
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("name", response.data)
        self.assertEqual(Category.objects.count(), 1)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name, "Tea")

    def test_invalid_status_on_create_and_update(self):
        self.client.force_authenticate(self.admin)
        for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
            response = method(url, {"name": "Tea", "status": "DELETED"}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertIn("status", response.data)

    def test_status_preserves_category_and_products(self):
        self.client.force_authenticate(self.admin)
        product = Product.objects.create(category=self.category, name="Tea cup", price="10000.00")
        for value in ("INACTIVE", "ACTIVE"):
            response = self.client.patch(self.status_url, {
                "status": value, "name": "Ignored", "description": "Ignored"
            }, format="json")
            self.assertEqual(response.status_code, 200)
            self.category.refresh_from_db()
            product.refresh_from_db()
            self.assertEqual(self.category.status, value)
            self.assertEqual(self.category.name, "Tea")
            self.assertEqual(self.category.description, "Tea drinks")
            self.assertEqual(product.category_id, self.category.pk)
            self.assertEqual(product.status, "ACTIVE")

    def test_status_requires_valid_value(self):
        self.client.force_authenticate(self.admin)
        for payload in ({}, {"status": ""}, {"status": None}, {"status": "active"}, {"status": "DELETED"}):
            with self.subTest(payload=payload):
                response = self.client.patch(self.status_url, payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertIn("status", response.data)
        self.category.refresh_from_db()
        self.assertEqual(self.category.status, "ACTIVE")

    def test_only_active_admin_can_write(self):
        users = [None]
        for index, attributes in enumerate([
            {"role": "CUSTOMER"},
            {"role": "CUSTOMER", "is_staff": True},
            {"role": "CUSTOMER", "is_superuser": True},
            {"role": "ADMIN", "status": "INACTIVE"},
            {"role": "ADMIN", "is_active": False},
        ]):
            users.append(get_user_model().objects.create(email=f"user{index}@example.com", **attributes))
        for user in users:
            self.client.force_authenticate(user)
            for method, url, payload in (
                (self.client.post, self.list_url, {"name": "Coffee"}),
                (self.client.put, self.detail_url, {"name": "Coffee"}),
                (self.client.patch, self.status_url, {"status": "INACTIVE"}),
            ):
                with self.subTest(user=user, url=url):
                    self.assertEqual(method(url, payload, format="json").status_code, 403)
        self.assertEqual(Category.objects.count(), 1)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name, "Tea")
        self.assertEqual(self.category.status, "ACTIVE")

    def test_missing_categories(self):
        self.client.force_authenticate(self.admin)
        url = reverse("category-detail", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.put(url, {"name": "Tea"}, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"{url}/status", {"status": "ACTIVE"}, format="json").status_code, 404)

    def test_delete_and_general_patch_disabled(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.delete(self.detail_url).status_code, 405)
        self.assertEqual(self.client.patch(self.detail_url, {"name": "Coffee"}, format="json").status_code, 405)
        self.assertTrue(Category.objects.filter(pk=self.category.pk, name="Tea").exists())

    def test_session_authentication_and_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.admin)
        self.assertEqual(client.get(self.list_url).status_code, 200)
        self.assertEqual(client.post(self.list_url, {"name": "Coffee"}, format="json").status_code, 403)
        token = "a" * 32
        client.cookies["csrftoken"] = token
        self.assertEqual(client.post(
            self.list_url, {"name": "Coffee"}, format="json", HTTP_X_CSRFTOKEN=token
        ).status_code, 201)