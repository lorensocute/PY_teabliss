from django.db import models
from django.db.models import Q


class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("INACTIVE", "Inactive"),
        ],
        default="ACTIVE"
    )

    class Meta:
        db_table = "categories"

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products"
    )

    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)

    price = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    stock_quantity = models.IntegerField(default=0)

    image_url = models.CharField(
        max_length=500,
        blank=True
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("INACTIVE", "Inactive"),
        ],
        default="ACTIVE"
    )

    class Meta:
        db_table = "products"

        constraints = [
            models.CheckConstraint(
                condition=Q(price__gte=0),
                name="product_price_gte_0"
            ),
            models.CheckConstraint(
                condition=Q(stock_quantity__gte=0),
                name="product_stock_gte_0"
            ),
        ]

    def __str__(self):
        return self.name