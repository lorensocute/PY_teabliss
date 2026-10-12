from django.contrib import admin
from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
	list_display = ("name", "status")
	list_filter = ("status",)
	search_fields = ("name",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
	list_display = ("name", "category", "price", "stock_quantity", "status")
	list_filter = ("status", "category")
	search_fields = ("name", "description")
