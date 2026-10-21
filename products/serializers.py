
from decimal import Decimal
from rest_framework import serializers
from .models import Category, Product


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "description", "status"]
        read_only_fields = ["id"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Tên danh mục không được để trống."
            )
        return value


class CategoryStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["status"]
        extra_kwargs = {"status": {"required": True}}


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True
    )

    price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0")
    )

    stock_quantity = serializers.IntegerField(
        min_value=0,
        max_value=2147483647,
        required=False
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "stock_quantity",
            "image_url",
            "category",
            "category_name",
            "status",
        ]
        read_only_fields = ["id", "category_name"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Tên sản phẩm không được để trống."
            )
        return value

    def validate_category(self, value):
        if (
            self.instance is None
            or self.instance.category_id != value.pk
        ) and value.status != "ACTIVE":
            raise serializers.ValidationError(
                "Danh mục phải đang ACTIVE."
            )
        return value


class ProductStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["status"]
        extra_kwargs = {"status": {"required": True}}
