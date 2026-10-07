from django.db import models
from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    username = None

    full_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, unique=True)
    phone = models.CharField(max_length=20, blank=True)

    role = models.CharField(
        max_length=20,
        choices=[
            ("CUSTOMER", "Customer"),
            ("ADMIN", "Admin"),
        ],
        default="CUSTOMER"
    )

    status = models.CharField(
        max_length=20,
        choices=[
            ("ACTIVE", "Active"),
            ("INACTIVE", "Inactive"),
        ],
        default="ACTIVE"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.email


class Address(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="addresses"
    )

    receiver_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    city = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    ward = models.CharField(max_length=100)
    address_detail = models.CharField(max_length=255)
    default_address = models.BooleanField(default=False)

    class Meta:
        db_table = "addresses"

    def __str__(self):
        return self.receiver_name