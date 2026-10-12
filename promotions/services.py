"""Checkout-ready promotion calculation, without writing orders or database rows.

Amounts must be Decimal, finite, nonnegative and have at most two decimal places.
Validity includes both start and end instants. Discounts round HALF_UP to cents.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

from .models import Promotion


class PromotionError(ValueError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class PromotionResult:
    promotion: Promotion
    discount_amount: Decimal
    total_after_discount: Decimal


def apply_promotion(code, subtotal, *, at=None):
    if not isinstance(subtotal, Decimal) or not subtotal.is_finite() or subtotal < 0:
        raise PromotionError("invalid_subtotal", "Subtotal must be a finite nonnegative Decimal.")
    if subtotal > Decimal("9999999999.99") or subtotal != subtotal.quantize(Decimal("0.01")):
        raise PromotionError("invalid_subtotal", "Subtotal is outside the supported money precision.")
    if not isinstance(code, str) or not code.strip():
        raise PromotionError("not_found", "Promotion code does not exist.")
    try:
        promotion = Promotion.objects.get(code__iexact=code.strip().upper())
    except Promotion.DoesNotExist:
        raise PromotionError("not_found", "Promotion code does not exist.")
    except Promotion.MultipleObjectsReturned:
        raise PromotionError("ambiguous_code", "Promotion code is not unique.")
    if promotion.status != "ACTIVE":
        raise PromotionError("inactive", "Promotion is inactive.")
    now = timezone.now() if at is None else at
    if timezone.is_naive(now):
        raise PromotionError("invalid_time", "A timezone-aware time is required.")
    if promotion.end_date <= promotion.start_date:
        raise PromotionError("invalid_configuration", "Invalid promotion validity period.")
    if not promotion.start_date <= now <= promotion.end_date:
        raise PromotionError("outside_validity", "Promotion is outside its validity period.")
    if promotion.minimum_order_value < 0 or promotion.discount_value <= 0:
        raise PromotionError("invalid_configuration", "Invalid promotion amounts.")
    if subtotal < promotion.minimum_order_value:
        raise PromotionError("minimum_order", "Subtotal does not meet the minimum order value.")
    if promotion.discount_type == "PERCENT":
        if promotion.discount_value > Decimal("100"):
            raise PromotionError("invalid_configuration", "Percentage cannot exceed 100.")
        discount = subtotal * promotion.discount_value / Decimal("100")
    elif promotion.discount_type == "FIXED":
        discount = promotion.discount_value
    else:
        raise PromotionError("invalid_configuration", "Unsupported discount type.")
    discount = min(subtotal, discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return PromotionResult(promotion, discount, subtotal - discount)
