from django.conf import settings
from django.db import models
from django.db.models import Q

from products.models import Product
from promotions.models import Promotion


class Order(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders"
    )

    promotion = models.ForeignKey(
        Promotion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders"
    )

    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2
    )

    discount_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0
    )

    total_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2
    )

    payment_method = models.CharField(
        max_length=20,
        default="COD"
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("PENDING", "Pending"),
            ("CONFIRMED", "Confirmed"),
            ("SHIPPING", "Shipping"),
            ("COMPLETED", "Completed"),
            ("CANCELLED", "Cancelled"),
        ],
        default="PENDING"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    receiver_name = models.CharField(max_length=100)
    receiver_phone = models.CharField(max_length=20)
    shipping_address = models.CharField(max_length=255)

    class Meta:
        db_table = "orders"

    def __str__(self):
        return f"Order {self.id}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items"
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="order_items"
    )

    quantity = models.IntegerField()

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    class Meta:
        db_table = "order_items"

        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name="order_item_quantity_gt_0"
            )
        ]

    def __str__(self):
        return f"Order {self.order_id} - {self.product.name}"