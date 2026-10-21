from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from django.urls import resolve, reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from .models import Promotion
from .services import PromotionError, apply_promotion


class PromotionAPITests(APITestCase):
    def setUp(self):
        self.now = timezone.now()
        self.promotion = Promotion.objects.create(
            code="TEA10", discount_type="PERCENT", discount_value="10.00",
            start_date=self.now - timedelta(days=1), end_date=self.now + timedelta(days=1),
        )
        self.admin = get_user_model().objects.create(email="admin@example.com", role="ADMIN")
        self.client.force_authenticate(self.admin)
        self.list_url = reverse("promotion-list")
        self.detail_url = reverse("promotion-detail", args=[self.promotion.pk])
        self.status_url = reverse("promotion-change-status", args=[self.promotion.pk])
        self.payload = {
            "code": "NEW", "discount_type": "FIXED", "discount_value": "5.50",
            "minimum_order_value": "10.00", "start_date": self.now.isoformat(),
            "end_date": (self.now + timedelta(days=2)).isoformat(),
        }

    def test_list_detail_and_routes(self):
        self.assertEqual(self.list_url, "/api/promotions")
        self.assertEqual(self.detail_url, f"/api/promotions/{self.promotion.pk}")
        self.assertEqual(self.status_url, f"{self.detail_url}/status")
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["code"] for row in response.data], ["TEA10"])
        response = self.client.get(self.detail_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["discount_value"], "10.00")

    def test_create_and_update(self):
        response = self.client.post(self.list_url, {**self.payload, "code": "  new  "}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["code"], "NEW")
        self.assertEqual(response.data["status"], "ACTIVE")
        self.assertEqual(Promotion.objects.get(pk=response.data["id"]).discount_value, Decimal("5.50"))
        response = self.client.put(self.detail_url, {**self.payload, "code": " updated ", "status": "INACTIVE"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.promotion.refresh_from_db()
        self.assertEqual(self.promotion.code, "UPDATED")
        self.assertEqual(self.promotion.discount_type, "FIXED")
        self.assertEqual(self.promotion.status, "INACTIVE")

    def test_case_insensitive_uniqueness(self):
        for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
            Promotion.objects.get_or_create(code="legacy", defaults={
                "discount_type": "FIXED", "discount_value": "1", "start_date": self.now,
                "end_date": self.now + timedelta(days=1),
            })
            response = method(url, {**self.payload, "code": " LEGACY "}, format="json")
            self.assertEqual(response.status_code, 400)
            self.assertIn("code", response.data)
        self.assertEqual(self.client.put(self.detail_url, {**self.payload, "code": "tea10"}, format="json").status_code, 200)

    def test_invalid_fields(self):
        invalid = {
            "code": ["", " \t\n ", None, "x" * 51, "ß" * 30],
            "discount_type": ["PERCENTAGE", "OTHER", None],
            "discount_value": ["0", "-1", "NaN", "1.001", None],
            "minimum_order_value": ["-0.01", None],
            "status": ["DELETED", "active", None],
            "end_date": [self.now.isoformat(), (self.now - timedelta(days=1)).isoformat(), "invalid"],
        }
        for field, values in invalid.items():
            for value in values:
                for method, url in ((self.client.post, self.list_url), (self.client.put, self.detail_url)):
                    with self.subTest(field=field, value=value, url=url):
                        response = method(url, {**self.payload, field: value}, format="json")
                        self.assertEqual(response.status_code, 400)
                        self.assertIn(field, response.data)
        self.assertEqual(Promotion.objects.count(), 1)

    def test_required_fields(self):
        for field in ("code", "discount_type", "discount_value", "start_date", "end_date"):
            payload = self.payload.copy()
            del payload[field]
            self.assertEqual(self.client.post(self.list_url, payload, format="json").status_code, 400)
            self.assertEqual(self.client.put(self.detail_url, payload, format="json").status_code, 400)

    def test_percentage_limit_and_zero_minimum(self):
        for value, expected in (("100.01", 400), ("100.00", 201)):
            response = self.client.post(self.list_url, {
                **self.payload, "discount_type": "PERCENT", "discount_value": value, "minimum_order_value": "0",
            }, format="json")
            self.assertEqual(response.status_code, expected)

    def test_all_reads_and_writes_require_active_admin(self):
        users = [None]
        for index, attrs in enumerate([
            {"role": "CUSTOMER"}, {"role": "CUSTOMER", "is_superuser": True},
            {"role": "CUSTOMER", "is_staff": True},
            {"role": "ADMIN", "status": "INACTIVE"}, {"role": "ADMIN", "is_active": False},
        ]):
            users.append(get_user_model().objects.create(email=f"user{index}@example.com", **attrs))
        for user in users:
            self.client.force_authenticate(user)
            self.assertEqual(self.client.get(self.list_url).status_code, 403)
            self.assertEqual(self.client.get(self.detail_url).status_code, 403)
            self.assertEqual(self.client.post(self.list_url, self.payload, format="json").status_code, 403)
            self.assertEqual(self.client.put(self.detail_url, self.payload, format="json").status_code, 403)
            self.assertEqual(self.client.patch(self.status_url, {"status": "INACTIVE"}, format="json").status_code, 403)
        self.promotion.refresh_from_db()
        self.assertEqual(self.promotion.status, "ACTIVE")
        self.assertEqual(Promotion.objects.count(), 1)

    def test_status_only(self):
        for value in ("INACTIVE", "ACTIVE"):
            response = self.client.patch(self.status_url, {"status": value, "code": "Ignored"}, format="json")
            self.assertEqual(response.status_code, 200)
            self.promotion.refresh_from_db()
            self.assertEqual(self.promotion.status, value)
            self.assertEqual(self.promotion.code, "TEA10")
        for payload in ({}, {"status": None}, {"status": "DELETED"}):
            self.assertEqual(self.client.patch(self.status_url, payload, format="json").status_code, 400)

    def test_delete_and_general_patch_blocked(self):
        self.assertEqual(self.client.delete(self.detail_url).status_code, 405)
        self.assertEqual(self.client.patch(self.detail_url, self.payload, format="json").status_code, 405)
        self.assertTrue(Promotion.objects.filter(pk=self.promotion.pk, code="TEA10").exists())

    def test_missing_promotion(self):
        url = reverse("promotion-detail", args=[999999])
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.put(url, self.payload, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"{url}/status", {"status": "ACTIVE"}, format="json").status_code, 404)

    def test_concurrent_duplicate_returns_validation_error(self):
        with patch("promotions.serializers.PromotionSerializer.save", side_effect=IntegrityError("duplicate")):
            response = self.client.post(self.list_url, self.payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("code", response.data)
        self.assertEqual(Promotion.objects.count(), 1)

    def test_session_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.admin)
        self.assertEqual(client.get(self.list_url).status_code, 200)
        self.assertEqual(client.post(self.list_url, self.payload, format="json").status_code, 403)
        token = "a" * 32
        client.cookies["csrftoken"] = token
        self.assertEqual(client.post(self.list_url, self.payload, format="json", HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_routing_preserves_existing_endpoints(self):
        for path, name in (
            ("/api/promotions", "promotion-list"),
            (self.detail_url, "promotion-detail"),
            (self.status_url, "promotion-change-status"),
            ("/api/categories", "category-list"),
            ("/api/products", "product-list"),
            ("/admin/", "index"),
        ):
            with self.subTest(path=path):
                self.assertEqual(resolve(path).url_name, name)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get("/api/categories").status_code, 200)
        self.assertEqual(self.client.get("/api/products").status_code, 200)
        self.assertEqual(self.client.get("/admin/").status_code, 302)

    def test_put_percentage_limit_preserves_data_on_failure(self):
        payload = {**self.payload, "code": "TEA10", "discount_type": "PERCENT", "discount_value": "100.01"}
        response = self.client.put(self.detail_url, payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("discount_value", response.data)
        self.promotion.refresh_from_db()
        self.assertEqual(self.promotion.discount_value, Decimal("10.00"))
        response = self.client.put(self.detail_url, {**payload, "discount_value": "100.00"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.promotion.refresh_from_db()
        self.assertEqual(self.promotion.discount_value, Decimal("100.00"))

    def test_dates_compare_absolute_instants_with_offsets(self):
        response = self.client.post(self.list_url, {
            **self.payload,
            "start_date": "2026-10-12T10:00:00+07:00",
            "end_date": "2026-10-12T03:00:00Z",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post(self.list_url, {
            **self.payload,
            "start_date": "2026-10-12T10:00:00+07:00",
            "end_date": "2026-10-12T03:00:01Z",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        promotion = Promotion.objects.get(pk=response.data["id"])
        self.assertEqual(promotion.end_date - promotion.start_date, timedelta(seconds=1))

    def test_invalid_status_does_not_modify_promotion(self):
        response = self.client.patch(self.status_url, {"status": "", "code": "Changed"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.promotion.refresh_from_db()
        self.assertEqual(self.promotion.status, "ACTIVE")
        self.assertEqual(self.promotion.code, "TEA10")


class PromotionServiceTests(TestCase):
    def setUp(self):
        self.now = timezone.now()
        self.promotion = Promotion.objects.create(
            code="TEA", discount_type="PERCENT", discount_value="10.00", minimum_order_value="10.00",
            start_date=self.now - timedelta(hours=1), end_date=self.now + timedelta(hours=1),
        )

    def assert_error(self, expected, code="TEA", subtotal=Decimal("100.00"), **kwargs):
        with self.assertRaises(PromotionError) as caught:
            apply_promotion(code, subtotal, **kwargs)
        self.assertEqual(caught.exception.code, expected)

    def test_percent_and_case_normalization(self):
        result = apply_promotion(" tea ", Decimal("100.00"))
        self.assertEqual(result.promotion.pk, self.promotion.pk)
        self.assertEqual(result.discount_amount, Decimal("10.00"))
        self.assertEqual(result.total_after_discount, Decimal("90.00"))
        self.assertIsInstance(result.discount_amount, Decimal)

    def test_fixed_and_cap(self):
        self.promotion.discount_type = "FIXED"
        self.promotion.discount_value = Decimal("150.00")
        self.promotion.save()
        result = apply_promotion("TEA", Decimal("100.00"))
        self.assertEqual(result.discount_amount, Decimal("100.00"))
        self.assertEqual(result.total_after_discount, Decimal("0.00"))
        self.promotion.discount_value = Decimal("5.50")
        self.promotion.save()
        self.assertEqual(apply_promotion("TEA", Decimal("100.00")).total_after_discount, Decimal("94.50"))

    def test_rounding(self):
        self.promotion.minimum_order_value = Decimal("0")
        self.promotion.save()
        self.assertEqual(apply_promotion("TEA", Decimal("0.05")).discount_amount, Decimal("0.01"))

    def test_missing_inactive_and_minimum(self):
        self.assert_error("not_found", code="MISSING")
        self.assert_error("not_found", code=" ")
        self.assert_error("minimum_order", subtotal=Decimal("9.99"))
        self.assertEqual(apply_promotion("TEA", Decimal("10.00")).discount_amount, Decimal("1.00"))
        self.promotion.status = "INACTIVE"
        self.promotion.save()
        self.assert_error("inactive")

    def test_validity_boundaries(self):
        for at in (self.promotion.start_date, self.promotion.end_date):
            self.assertEqual(apply_promotion("TEA", Decimal("100"), at=at).discount_amount, Decimal("10.00"))
        for at in (self.promotion.start_date - timedelta(microseconds=1), self.promotion.end_date + timedelta(microseconds=1)):
            self.assert_error("outside_validity", at=at)
        with patch("promotions.services.timezone.now", return_value=self.promotion.end_date + timedelta(seconds=1)):
            self.assert_error("outside_validity")
        self.assert_error("invalid_time", at=self.now.replace(tzinfo=None))

    def test_invalid_subtotal(self):
        for subtotal in (100.0, "100", Decimal("-1"), Decimal("NaN"), Decimal("Infinity"), Decimal("1.001"), Decimal("10000000000000")):
            self.assert_error("invalid_subtotal", subtotal=subtotal)

    def test_zero_order_and_full_percentage(self):
        self.promotion.minimum_order_value = Decimal("0")
        self.promotion.discount_value = Decimal("100")
        self.promotion.save()
        for subtotal in (Decimal("0.00"), Decimal("100.00")):
            result = apply_promotion("TEA", subtotal)
            self.assertEqual(result.discount_amount, subtotal)
            self.assertEqual(result.total_after_discount, Decimal("0"))

    def test_invalid_stored_configuration(self):
        for field, value in (("discount_type", "OTHER"), ("discount_value", Decimal("101")),
                             ("discount_value", Decimal("0")), ("minimum_order_value", Decimal("-1")),
                             ("end_date", self.promotion.start_date)):
            original = getattr(self.promotion, field)
            setattr(self.promotion, field, value)
            self.promotion.save()
            self.assert_error("invalid_configuration")
            setattr(self.promotion, field, original)
            self.promotion.save()

    def test_calculation_does_not_write_to_database(self):
        with self.assertNumQueries(1):
            result = apply_promotion("TEA", Decimal("100.00"), at=self.now)
        self.assertEqual(result.total_after_discount, Decimal("90.00"))
        self.promotion.refresh_from_db()
        self.assertEqual(self.promotion.discount_value, Decimal("10.00"))
        self.assertEqual(self.promotion.status, "ACTIVE")

    def test_order_decimal_subtotal_boundaries(self):
        for subtotal in (Decimal("10000000000.00"), Decimal("9999999999999.99")):
            with self.subTest(subtotal=subtotal):
                result = apply_promotion("TEA", subtotal)
                self.assertEqual(result.discount_amount, (subtotal * Decimal("0.10")).quantize(Decimal("0.01")))
                self.assertEqual(result.total_after_discount, subtotal - result.discount_amount)
        self.assert_error("invalid_subtotal", subtotal=Decimal("10000000000000.00"))
        self.assert_error("invalid_subtotal", subtotal=Decimal("9999999999999.999"))
