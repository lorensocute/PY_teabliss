from rest_framework import serializers

from .models import Order, OrderItem


class AdminOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "price"]
        read_only_fields = fields


class AdminOrderSerializer(serializers.ModelSerializer):
    customer_email = serializers.EmailField(source="user.email", read_only=True)
    items = AdminOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "user", "customer_email", "promotion", "subtotal", "discount_amount",
                  "total_amount", "payment_method", "status", "created_at", "receiver_name",
                  "receiver_phone", "shipping_address", "items"]
        read_only_fields = fields


class AdminOrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order._meta.get_field("status").choices)

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            unexpected = set(data.keys()) - {"status"}
            if unexpected:
                raise serializers.ValidationError({field: "Only status may be updated." for field in sorted(unexpected)})
        return super().to_internal_value(data)
