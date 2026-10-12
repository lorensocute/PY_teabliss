from decimal import Decimal

from rest_framework.test import APITestCase

from .models import Category, Product


class ProductCatalogTests(APITestCase):
	def setUp(self):
		self.category = Category.objects.create(name="Milk Tea", status="ACTIVE")
		self.product = Product.objects.create(
			category=self.category,
			name="Brown Sugar Milk Tea",
			description="Fresh milk and brown sugar",
			price=Decimal("55000.00"),
			stock_quantity=8,
			image_url="https://example.com/milk-tea.jpg",
			status="ACTIVE",
		)
		self.hidden_product = Product.objects.create(
			category=self.category,
			name="Unavailable Tea",
			price=Decimal("40000.00"),
			stock_quantity=0,
			status="INACTIVE",
		)

	def test_catalog_returns_only_active_products(self):
		response = self.client.get("/api/products/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item["id"] for item in response.data], [self.product.id])
		self.assertEqual(response.data[0]["category_name"], "Milk Tea")

	def test_catalog_supports_search_and_category_filter(self):
		response = self.client.get("/api/products/?q=brown&category={}".format(self.category.id))

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item["id"] for item in response.data], [self.product.id])

	def test_product_detail_does_not_expose_inactive_product(self):
		response = self.client.get(f"/api/products/{self.hidden_product.id}/")

		self.assertEqual(response.status_code, 404)

	def test_categories_returns_only_active_categories(self):
		Category.objects.create(name="Hidden", status="INACTIVE")

		response = self.client.get("/api/categories/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item["id"] for item in response.data], [self.category.id])
