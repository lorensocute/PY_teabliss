from django.db.models import Q
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny

from .models import Category, Product
from .serializers import CategorySerializer, ProductSerializer


class CategoryListView(generics.ListAPIView):
	permission_classes = [AllowAny]
	serializer_class = CategorySerializer
	queryset = Category.objects.filter(status="ACTIVE").order_by("name")


class ProductListView(generics.ListAPIView):
	permission_classes = [AllowAny]
	serializer_class = ProductSerializer

	def get_queryset(self):
		products = Product.objects.filter(
			status="ACTIVE",
			category__status="ACTIVE",
		).select_related("category").order_by("id")

		category_id = self.request.query_params.get("category")
		if category_id:
			try:
				category_id = int(category_id)
			except ValueError as error:
				raise ValidationError({"category": "ID danh mục phải là số nguyên."}) from error
			products = products.filter(category_id=category_id)

		search = self.request.query_params.get("q", "").strip()
		if search:
			products = products.filter(
				Q(name__icontains=search)
				| Q(description__icontains=search)
				| Q(category__name__icontains=search)
			)
		return products


class ProductDetailView(generics.RetrieveAPIView):
	permission_classes = [AllowAny]
	serializer_class = ProductSerializer
	queryset = Product.objects.filter(
		status="ACTIVE",
		category__status="ACTIVE",
	).select_related("category")
