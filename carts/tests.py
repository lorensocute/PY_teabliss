from decimal import Decimal

from rest_framework.test import APITestCase

from carts.models import Cart, CartItem
from products.models import Category, Product
from users.models import User


class CartApiTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			email="cart@example.com",
			password="StrongPass123!",
			full_name="Cart Customer",
		)
		self.category = Category.objects.create(name="Tea", status="ACTIVE")
		self.product = Product.objects.create(
			category=self.category,
			name="Milk Tea",
			price=Decimal("45000.00"),
			stock_quantity=5,
			status="ACTIVE",
		)
		self.client.force_authenticate(self.user)

	def test_adding_existing_product_increments_cart_quantity(self):
		url = "/api/cart/add/"
		self.client.post(url, {"product": self.product.id, "quantity": 1}, format="json")
		response = self.client.post(url, {"product": self.product.id, "quantity": 2}, format="json")

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data["quantity"], 3)
		self.assertEqual(CartItem.objects.filter(cart__user=self.user).count(), 1)

	def test_adding_unknown_product_returns_not_found(self):
		response = self.client.post(
			"/api/cart/add/",
			{"product": 99999, "quantity": 1},
			format="json",
		)

		self.assertEqual(response.status_code, 404)
		self.assertFalse(Cart.objects.filter(user=self.user).exists())

	def test_adding_inactive_product_returns_not_found(self):
		self.product.status = "INACTIVE"
		self.product.save(update_fields=["status"])

		response = self.client.post(
			"/api/cart/add/",
			{"product": self.product.id, "quantity": 1},
			format="json",
		)

		self.assertEqual(response.status_code, 404)

	def test_non_positive_quantity_is_rejected(self):
		response = self.client.post(
			"/api/cart/add/",
			{"product": self.product.id, "quantity": 0},
			format="json",
		)

		self.assertEqual(response.status_code, 400)

	def test_user_cannot_update_another_users_cart_item(self):
		other_user = User.objects.create_user(
			email="other-cart@example.com",
			password="StrongPass123!",
			full_name="Other Customer",
		)
		other_cart = Cart.objects.create(user=other_user)
		item = CartItem.objects.create(cart=other_cart, product=self.product, quantity=1)

		response = self.client.put(
			f"/api/cart/update/{item.id}/",
			{"quantity": 3},
			format="json",
		)

		self.assertEqual(response.status_code, 404)
		item.refresh_from_db()
		self.assertEqual(item.quantity, 1)
