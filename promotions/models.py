from django.db import models


class Promotion(models.Model):
    code = models.CharField(
        max_length=50,
        unique=True
    )

    discount_type = models.CharField(
        max_length=20,
        choices=[
            ("FIXED", "Fixed"),
            ("PERCENT", "Percent"),
        ]
    )

    discount_value = models.DecimalField(
        max_digits=12,
        decimal_places=2
    )

    minimum_order_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0
    )

    start_date = models.DateTimeField()
    end_date = models.DateTimeField()

    status = models.CharField(
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("INACTIVE", "Inactive"),
        ],
        default="ACTIVE"
    )

    class Meta:
        db_table = "promotions"

    def __str__(self):
        return self.code