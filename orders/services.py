from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from carts.models import Cart, CartItem
from products.models import Product
from promotions.models import Promotion

from .models import Order, OrderItem


CENT = Decimal("0.01")
ALLOWED_STATUS_TRANSITIONS = {
    "PENDING": {"CONFIRMED", "CANCELLED"},
    "CONFIRMED": {"SHIPPING", "CANCELLED"},
    "SHIPPING": {"COMPLETED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}


def list_user_orders(*, user):
    return Order.objects.filter(user=user).select_related("promotion").prefetch_related(
        "items__product"
    ).order_by("-created_at")


def get_user_order(*, user, order_id):
    return Order.objects.select_related("promotion").prefetch_related("items__product").get(
        pk=order_id,
        user=user,
    )


@transaction.atomic
def update_order_status(*, order_id, new_status):
    order = Order.objects.select_for_update().get(pk=order_id)
    allowed_statuses = ALLOWED_STATUS_TRANSITIONS[order.status]
    if new_status not in allowed_statuses:
        status_labels = dict(Order._meta.get_field("status").choices)
        raise ValidationError({
            "status": (
                f"Không thể chuyển đơn hàng từ {status_labels[order.status]} "
                f"sang {status_labels[new_status]}."
            )
        })

    if new_status == "CANCELLED":
        order_items = list(
            OrderItem.objects.filter(order=order).order_by("product_id")
        )
        products = {
            product.pk: product
            for product in Product.objects.select_for_update()
            .filter(pk__in=[item.product_id for item in order_items])
            .order_by("pk")
        }
        for item in order_items:
            product = products[item.product_id]
            product.stock_quantity += item.quantity
            product.save(update_fields=["stock_quantity"])

    order.status = new_status
    order.save(update_fields=["status"])
    return order


@transaction.atomic
def create_order(*, user, checkout_data):
    cart, _ = Cart.objects.get_or_create(user=user)
    cart = Cart.objects.select_for_update().get(pk=cart.pk)
    cart_items = list(
        CartItem.objects.select_for_update()
        .filter(cart=cart)
        .order_by("product_id")
    )
    if not cart_items:
        raise ValidationError({"detail": "Giỏ hàng đang trống."})

    products = {
        product.pk: product
        for product in Product.objects.select_for_update()
        .select_related("category")
        .filter(pk__in=[item.product_id for item in cart_items])
        .order_by("pk")
    }

    subtotal = Decimal("0.00")
    for item in cart_items:
        product = products.get(item.product_id)
        if (
            product is None
            or product.status != "ACTIVE"
            or product.category.status != "ACTIVE"
        ):
            raise ValidationError({"detail": "Một sản phẩm trong giỏ không còn được bán."})
        if product.stock_quantity < item.quantity:
            raise ValidationError({
                "detail": f"Sản phẩm {product.name} không đủ số lượng tồn kho."
            })
        subtotal += product.price * item.quantity
    subtotal = subtotal.quantize(CENT, rounding=ROUND_HALF_UP)

    promotion = None
    discount_amount = Decimal("0.00")
    code = checkout_data.get("promotion_code", "").strip()
    if code:
        promotion = Promotion.objects.select_for_update().filter(code__iexact=code).first()
        now = timezone.now()
        if (
            promotion is None
            or promotion.status != "ACTIVE"
            or not promotion.start_date <= now <= promotion.end_date
        ):
            raise ValidationError({"promotion_code": "Mã khuyến mãi không hợp lệ hoặc đã hết hạn."})
        if subtotal < promotion.minimum_order_value:
            raise ValidationError({"promotion_code": "Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã."})
        if promotion.discount_type == "FIXED":
            discount_amount = promotion.discount_value
        elif promotion.discount_type == "PERCENT":
            discount_amount = subtotal * promotion.discount_value / Decimal("100")
        else:
            raise ValidationError({"promotion_code": "Loại khuyến mãi không được hỗ trợ."})
        discount_amount = min(discount_amount, subtotal).quantize(CENT, rounding=ROUND_HALF_UP)

    order = Order.objects.create(
        user=user,
        promotion=promotion,
        subtotal=subtotal,
        discount_amount=discount_amount,
        total_amount=subtotal - discount_amount,
        payment_method=checkout_data["payment_method"],
        receiver_name=checkout_data["receiver_name"],
        receiver_phone=checkout_data["receiver_phone"],
        shipping_address=checkout_data["shipping_address"],
        status="PENDING",
    )

    order_items = []
    for cart_item in cart_items:
        product = products[cart_item.product_id]
        order_items.append(OrderItem(
            order=order,
            product=product,
            quantity=cart_item.quantity,
            price=product.price,
        ))
        product.stock_quantity -= cart_item.quantity
        product.save(update_fields=["stock_quantity"])

    OrderItem.objects.bulk_create(order_items)
    CartItem.objects.filter(pk__in=[item.pk for item in cart_items]).delete()
    return order