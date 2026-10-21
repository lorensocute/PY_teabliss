from django.contrib.auth import get_user_model
from django.urls import resolve, reverse
from rest_framework.test import APITestCase, APIClient


class AdminUserAPITests(APITestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create(email="admin@example.com", full_name="Tea Admin", role="ADMIN")
        self.customer = get_user_model().objects.create(email="customer@example.com", full_name="Tea Customer", phone="123")
        self.customer.set_password("CustomerPassword123!")
        self.customer.save(update_fields=["password"])
        self.list_url = reverse("admin-user-list")
        self.detail_url = reverse("admin-user-detail", args=[self.customer.pk])
        self.status_url = reverse("admin-user-change-status", args=[self.customer.pk])
        self.client.force_authenticate(self.admin)

    def test_routes_do_not_conflict(self):
        for path, name in (
            ("/api/admin/users", "admin-user-list"),
            (self.detail_url, "admin-user-detail"),
            (self.status_url, "admin-user-change-status"),
            ("/admin/", "index"), ("/api/categories", "category-list"),
            ("/api/products", "product-list"), ("/api/promotions", "promotion-list"),
        ):
            self.assertEqual(resolve(path).url_name, name)
        self.assertEqual(self.detail_url, f"/api/admin/users/{self.customer.pk}")
        self.assertEqual(self.status_url, f"{self.detail_url}/status")

    def test_list_and_detail_expose_only_safe_fields(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        safe_fields = {"id", "email", "full_name", "phone", "role", "status"}
        for row in response.data:
            self.assertEqual(set(row), safe_fields)
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), safe_fields)
        self.assertEqual(response.data["email"], self.customer.email)
        self.assertNotIn(self.customer.password, response.content.decode())

    def test_search_and_filters(self):
        get_user_model().objects.create(email="disabled@example.com", full_name="Disabled", status="INACTIVE", is_active=False)
        for params, expected in (
            ({"search": "CUSTOMER@"}, [self.customer.pk]),
            ({"search": "tea customer"}, [self.customer.pk]),
            ({"role": "ADMIN"}, [self.admin.pk]),
            ({"status": "ACTIVE"}, [self.admin.pk, self.customer.pk]),
            ({"role": "CUSTOMER", "status": "ACTIVE", "search": "tea"}, [self.customer.pk]),
            ({"search": "missing"}, []),
        ):
            with self.subTest(params=params):
                response = self.client.get(self.list_url, params)
                self.assertEqual(response.status_code, 200)
                self.assertEqual([row["id"] for row in response.data], expected)

    def test_invalid_filters(self):
        for params in ({"role": "STAFF"}, {"status": "active"}):
            self.assertEqual(self.client.get(self.list_url, params).status_code, 400)

    def test_only_active_admin_has_access(self):
        users = [None, self.customer]
        for index, attrs in enumerate([
            {"role": "ADMIN", "is_active": False}, {"role": "ADMIN", "status": "INACTIVE"},
            {"role": "CUSTOMER", "is_superuser": True}, {"role": "CUSTOMER", "is_staff": True},
        ]):
            users.append(get_user_model().objects.create(email=f"user{index}@example.com", **attrs))
        for user in users:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.list_url).status_code, 403)
            self.assertEqual(self.client.get(self.detail_url).status_code, 403)
            self.assertEqual(self.client.patch(self.status_url, {"status": "INACTIVE"}, format="json").status_code, 403)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.status, "ACTIVE")

    def test_lock_and_unlock_preserve_other_fields(self):
        original_password = self.customer.password
        for value in ("INACTIVE", "ACTIVE"):
            response = self.client.patch(self.status_url, {"status": value}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.data), {"id", "email", "full_name", "phone", "role", "status"})
            self.customer.refresh_from_db()
            self.assertEqual(self.customer.status, value)
            self.assertEqual(self.customer.is_active, value == "ACTIVE")
            self.assertEqual(self.customer.password, original_password)
            self.assertEqual(self.customer.email, "customer@example.com")
            self.assertEqual(self.customer.role, "CUSTOMER")

    def test_self_lock_denied(self):
        url = reverse("admin-user-change-status", args=[self.admin.pk])
        self.assertEqual(self.client.patch(url, {"status": "INACTIVE"}, format="json").status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
        self.assertEqual(self.admin.status, "ACTIVE")
        self.assertEqual(self.client.patch(url, {"status": "ACTIVE"}, format="json").status_code, 200)

    def test_superuser_lock_denied(self):
        user = get_user_model().objects.create(email="super@example.com", role="ADMIN", is_superuser=True)
        url = reverse("admin-user-change-status", args=[user.pk])
        self.assertEqual(self.client.patch(url, {"status": "INACTIVE"}, format="json").status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertEqual(user.status, "ACTIVE")

    def test_invalid_status_and_other_fields_rejected(self):
        for payload in ({}, {"status": ""}, {"status": None}, {"status": "active"}, {"status": "DELETED"},
                        {"status": "INACTIVE", "role": "ADMIN"}, {"status": "INACTIVE", "password": "Changed"}):
            with self.subTest(payload=payload):
                self.assertEqual(self.client.patch(self.status_url, payload, format="json").status_code, 400)
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.is_active)
        self.assertEqual(self.customer.role, "CUSTOMER")

    def test_unsupported_methods(self):
        self.assertEqual(self.client.post(self.list_url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.put(self.detail_url, {}, format="json").status_code, 405)
        self.assertEqual(self.client.patch(self.detail_url, {"status": "INACTIVE"}, format="json").status_code, 405)
        self.assertEqual(self.client.delete(self.detail_url).status_code, 405)
        self.assertTrue(get_user_model().objects.filter(pk=self.customer.pk).exists())

    def test_missing_user(self):
        url = reverse("admin-user-detail", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(f"{url}/status", {"status": "INACTIVE"}, format="json").status_code, 404)

    def test_lock_disables_authentication_and_existing_session(self):
        user = get_user_model().objects.create(email="otheradmin@example.com", role="ADMIN")
        user.set_password("AdminPassword123!")
        user.save(update_fields=["password"])
        session_client = APIClient()
        self.assertTrue(session_client.login(email=user.email, password="AdminPassword123!"))
        self.assertEqual(session_client.get(self.list_url).status_code, 200)
        url = reverse("admin-user-change-status", args=[user.pk])
        self.assertEqual(self.client.patch(url, {"status": "INACTIVE"}, format="json").status_code, 200)
        self.assertEqual(session_client.get(self.list_url).status_code, 403)
        self.assertFalse(APIClient().login(email=user.email, password="AdminPassword123!"))
        self.assertEqual(self.client.patch(url, {"status": "ACTIVE"}, format="json").status_code, 200)
        self.assertTrue(APIClient().login(email=user.email, password="AdminPassword123!"))

    def test_session_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.admin)
        self.assertEqual(client.get(self.list_url).status_code, 200)
        self.assertEqual(client.patch(self.status_url, {"status": "INACTIVE"}, format="json").status_code, 403)
        token = "a" * 32
        client.cookies["csrftoken"] = token
        self.assertEqual(client.patch(self.status_url, {"status": "INACTIVE"}, format="json", HTTP_X_CSRFTOKEN=token).status_code, 200)
