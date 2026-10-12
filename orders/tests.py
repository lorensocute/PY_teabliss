from datetime import timedelta
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from carts.models import Cart, CartItem
from orders.models import Order, OrderItem
from products.models import Category, Product
from users.models import User


class OrderCheckoutTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			email="customer@example.com",
			password="StrongPass123!",
			full_name="Tea Customer",
		)
		self.category = Category.objects.create(name="Tea")
		self.product = Product.objects.create(
			category=self.category,
			name="Milk tea",
			price=Decimal("45000.00"),
			stock_quantity=5,
			status="ACTIVE",
		)
		self.cart = Cart.objects.create(user=self.user)
		self.admin = User.objects.create_user(
			email="admin@example.com",
			password="AdminStrong123!",
			full_name="Tea Admin",
			role="ADMIN",
		)
		self.client.force_authenticate(self.user)
		self.url = "/api/orders/"
		self.admin_status_url = "/api/admin/orders/{}/status/"
		self.payload = {
			"recipient_name": "Tea Customer",
			"recipient_phone": "0900000000",
			"shipping_address": "1 Tea Street",
			"payment_method": "COD",
		}

	def test_checkout_creates_order_decrements_stock_and_clears_cart(self):
		CartItem.objects.create(cart=self.cart, product=self.product, quantity=2)

		response = self.client.post(self.url, self.payload, format="json")

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data["status"], "PENDING")
		self.assertEqual(response.data["status_label"], "Đang chờ xác nhận")
		self.assertEqual(Decimal(response.data["total_amount"]), Decimal("90000.00"))
		self.assertEqual(Decimal(response.data["final_amount"]), Decimal("90000.00"))
		self.assertEqual(response.data["items"][0]["product_name"], "Milk tea")
		self.assertEqual(response.data["items"][0]["quantity"], 2)
		self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock_quantity, 3)
		self.assertFalse(CartItem.objects.filter(cart=self.cart).exists())

	def test_checkout_rejects_insufficient_stock_without_changing_cart(self):
		CartItem.objects.create(cart=self.cart, product=self.product, quantity=6)

		response = self.client.post(self.url, self.payload, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertEqual(self.product.__class__.objects.get(pk=self.product.pk).stock_quantity, 5)
		self.assertTrue(CartItem.objects.filter(cart=self.cart).exists())

	def test_checkout_rejects_inactive_product_without_creating_order(self):
		CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)
		self.product.status = "INACTIVE"
		self.product.save(update_fields=["status"])

		response = self.client.post(self.url, self.payload, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(self.user.orders.exists())
		self.assertTrue(CartItem.objects.filter(cart=self.cart).exists())

	def test_checkout_rejects_product_in_inactive_category(self):
		CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)
		self.category.status = "INACTIVE"
		self.category.save(update_fields=["status"])

		response = self.client.post(self.url, self.payload, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(self.user.orders.exists())
		self.assertTrue(CartItem.objects.filter(cart=self.cart).exists())

	def test_checkout_rejects_empty_cart(self):
		response = self.client.post(self.url, self.payload, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(self.user.orders.exists())

	def test_checkout_applies_valid_fixed_promotion(self):
		from promotions.models import Promotion

		CartItem.objects.create(cart=self.cart, product=self.product, quantity=2)
		now = timezone.now()
		Promotion.objects.create(
			code="TEA10",
			discount_type="FIXED",
			discount_value=Decimal("10000.00"),
			minimum_order_value=Decimal("50000.00"),
			start_date=now - timedelta(days=1),
			end_date=now + timedelta(days=1),
			status="ACTIVE",
		)

		response = self.client.post(
			self.url,
			{**self.payload, "promotion_code": "TEA10"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Decimal(response.data["discount_amount"]), Decimal("10000.00"))
		self.assertEqual(Decimal(response.data["final_amount"]), Decimal("80000.00"))

	def test_checkout_applies_percentage_promotion(self):
		from promotions.models import Promotion

		CartItem.objects.create(cart=self.cart, product=self.product, quantity=2)
		now = timezone.now()
		Promotion.objects.create(
			code="TEA20",
			discount_type="PERCENT",
			discount_value=Decimal("20.00"),
			minimum_order_value=Decimal("0.00"),
			start_date=now - timedelta(days=1),
			end_date=now + timedelta(days=1),
			status="ACTIVE",
		)

		response = self.client.post(
			self.url,
			{**self.payload, "promotion_code": "TEA20"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertEqual(Decimal(response.data["discount_amount"]), Decimal("18000.00"))
		self.assertEqual(Decimal(response.data["final_amount"]), Decimal("72000.00"))

	def test_order_history_only_returns_current_users_orders(self):
		own_order = Order.objects.create(
			user=self.user,
			subtotal=Decimal("45000.00"),
			discount_amount=Decimal("0.00"),
			total_amount=Decimal("45000.00"),
			receiver_name="Tea Customer",
			receiver_phone="0900000000",
			shipping_address="1 Tea Street",
		)
		other_user = User.objects.create_user(
			email="other@example.com",
			password="StrongPass123!",
			full_name="Other Customer",
		)
		other_order = Order.objects.create(
			user=other_user,
			subtotal=Decimal("45000.00"),
			discount_amount=Decimal("0.00"),
			total_amount=Decimal("45000.00"),
			receiver_name="Other Customer",
			receiver_phone="0911111111",
			shipping_address="2 Tea Street",
		)

		response = self.client.get(self.url)

		self.assertEqual(response.status_code, 200)
		self.assertEqual([order["id"] for order in response.data], [own_order.id])
		self.assertNotIn(other_order.id, [order["id"] for order in response.data])

	def test_user_cannot_view_another_users_order_detail(self):
		other_user = User.objects.create_user(
			email="other@example.com",
			password="StrongPass123!",
			full_name="Other Customer",
		)
		other_order = Order.objects.create(
			user=other_user,
			subtotal=Decimal("45000.00"),
			discount_amount=Decimal("0.00"),
			total_amount=Decimal("45000.00"),
			receiver_name="Other Customer",
			receiver_phone="0911111111",
			shipping_address="2 Tea Street",
		)

		response = self.client.get(f"{self.url}{other_order.id}/")

		self.assertEqual(response.status_code, 404)

	def test_order_detail_includes_item_snapshot(self):
		order = Order.objects.create(
			user=self.user,
			subtotal=Decimal("90000.00"),
			discount_amount=Decimal("0.00"),
			total_amount=Decimal("90000.00"),
			receiver_name="Tea Customer",
			receiver_phone="0900000000",
			shipping_address="1 Tea Street",
		)
		OrderItem.objects.create(
			order=order,
			product=self.product,
			quantity=2,
			price=Decimal("45000.00"),
		)

		response = self.client.get(f"{self.url}{order.id}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["items"][0]["product_name"], "Milk tea")
		self.assertEqual(response.data["items"][0]["quantity"], 2)

	def create_order_record(self, *, status="PENDING"):
		return Order.objects.create(
			user=self.user,
			subtotal=Decimal("90000.00"),
			discount_amount=Decimal("0.00"),
			total_amount=Decimal("90000.00"),
			receiver_name="Tea Customer",
			receiver_phone="0900000000",
			shipping_address="1 Tea Street",
			status=status,
		)

	def test_admin_can_update_order_through_allowed_status_flow(self):
		order = self.create_order_record()
		self.client.force_authenticate(self.admin)

		for next_status in ["CONFIRMED", "SHIPPING", "COMPLETED"]:
			response = self.client.patch(
				self.admin_status_url.format(order.id),
				{"status": next_status},
				format="json",
			)
			self.assertEqual(response.status_code, 200)
			self.assertEqual(response.data["status"], next_status)
			self.assertEqual(response.data["status_label"], {
				"CONFIRMED": "Đang xử lý",
				"SHIPPING": "Đang vận chuyển",
				"COMPLETED": "Đã giao",
			}[next_status])

	def test_admin_cannot_skip_order_status(self):
		order = self.create_order_record()
		self.client.force_authenticate(self.admin)

		response = self.client.patch(
			self.admin_status_url.format(order.id),
			{"status": "SHIPPING"},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		order.refresh_from_db()
		self.assertEqual(order.status, "PENDING")

	def test_customer_cannot_update_order_status(self):
		order = self.create_order_record()

		response = self.client.patch(
			self.admin_status_url.format(order.id),
			{"status": "CONFIRMED"},
			format="json",
		)

		self.assertEqual(response.status_code, 403)
		order.refresh_from_db()
		self.assertEqual(order.status, "PENDING")

	def test_cancelling_order_restores_stock_only_once(self):
		order = self.create_order_record()
		OrderItem.objects.create(
			order=order,
			product=self.product,
			quantity=2,
			price=Decimal("45000.00"),
		)
		self.product.stock_quantity = 3
		self.product.save(update_fields=["stock_quantity"])
		self.client.force_authenticate(self.admin)

		response = self.client.patch(
			self.admin_status_url.format(order.id),
			{"status": "CANCELLED"},
			format="json",
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["status"], "CANCELLED")
		self.product.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, 5)

		repeat_response = self.client.patch(
			self.admin_status_url.format(order.id),
			{"status": "CANCELLED"},
			format="json",
		)
		self.assertEqual(repeat_response.status_code, 400)
		self.product.refresh_from_db()
		self.assertEqual(self.product.stock_quantity, 5)

	def test_admin_status_endpoint_returns_404_for_unknown_order(self):
		self.client.force_authenticate(self.admin)

		response = self.client.patch(
			self.admin_status_url.format(999999),
			{"status": "CONFIRMED"},
			format="json",
		)

		self.assertEqual(response.status_code, 404)
