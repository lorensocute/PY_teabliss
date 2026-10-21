from decimal import Decimal

from rest_framework import serializers

from .models import Promotion


class PromotionSerializer(serializers.ModelSerializer):
    code = serializers.CharField(max_length=50)
    discount_value = serializers.DecimalField(max_digits=12, decimal_places=2)
    minimum_order_value = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False
    )

    class Meta:
        model = Promotion
        fields = ["id", "code", "discount_type", "discount_value",
                  "minimum_order_value", "start_date", "end_date", "status"]
        read_only_fields = ["id"]

    def validate_code(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("Code must not be blank.")
        if len(value) > 50:
            raise serializers.ValidationError("Code must contain at most 50 characters.")
        queryset = Promotion.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("This promotion code already exists.")
        return value

    def validate_discount_value(self, value):
        if value <= 0:
            raise serializers.ValidationError("Discount must be greater than zero.")
        return value

    def validate(self, attrs):
        def current(field):
            return attrs.get(field, getattr(self.instance, field, None))

        if current("discount_type") == "PERCENT" and current("discount_value") > Decimal("100"):
            raise serializers.ValidationError({"discount_value": "Percentage cannot exceed 100."})
        if current("end_date") <= current("start_date"):
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        return attrs


class PromotionStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Promotion
        fields = ["status"]
        extra_kwargs = {"status": {"required": True}}
