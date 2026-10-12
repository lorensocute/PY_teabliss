from rest_framework import serializers

from .models import Order, OrderItem


class CheckoutSerializer(serializers.Serializer):
    recipient_name = serializers.CharField(source="receiver_name", max_length=100)
    recipient_phone = serializers.CharField(source="receiver_phone", max_length=20)
    shipping_address = serializers.CharField(max_length=255)
    payment_method = serializers.ChoiceField(choices=[("COD", "COD")], default="COD")
    promotion_code = serializers.CharField(max_length=50, required=False, allow_blank=True)


class OrderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order._meta.get_field("status").choices)


class OrderItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source="product.id", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["product_id", "product_name", "quantity", "price"]


class OrderSerializer(serializers.ModelSerializer):
    total_amount = serializers.DecimalField(source="subtotal", max_digits=15, decimal_places=2, read_only=True)
    final_amount = serializers.DecimalField(source="total_amount", max_digits=15, decimal_places=2, read_only=True)
    status_label = serializers.SerializerMethodField()
    recipient_name = serializers.CharField(source="receiver_name", read_only=True)
    recipient_phone = serializers.CharField(source="receiver_phone", read_only=True)
    promotion_code = serializers.CharField(source="promotion.code", read_only=True, allow_null=True)
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "total_amount",
            "discount_amount",
            "final_amount",
            "payment_method",
            "status",
            "status_label",
            "created_at",
            "recipient_name",
            "recipient_phone",
            "shipping_address",
            "promotion_code",
            "items",
        ]

    def get_status_label(self, order):
        return order.get_status_display()