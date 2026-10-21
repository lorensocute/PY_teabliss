from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from products.permissions import IsActiveAdmin
from products.pagination import OptionalPageNumberPagination
from .admin_serializers import AdminOrderSerializer, AdminOrderStatusSerializer
from .models import Order, OrderItem


class AdminOrderViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = Order.objects.select_related("user").defer("user__password").prefetch_related(
        Prefetch("items", queryset=OrderItem.objects.select_related("product").order_by("id"))
    ).order_by("-created_at", "-id")
    serializer_class = AdminOrderSerializer
    pagination_class = OptionalPageNumberPagination
    permission_classes = [IsActiveAdmin]
    http_method_names = ["get", "patch", "head", "options"]
    transitions = {
        "PENDING": {"CONFIRMED", "CANCELLED"},
        "CONFIRMED": {"SHIPPING", "CANCELLED"},
        "SHIPPING": {"COMPLETED"},
        "COMPLETED": set(), "CANCELLED": set(),
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        params = self.request.query_params
        if "status" in params:
            if params["status"] not in self.transitions:
                raise ValidationError({"status": "Invalid status filter."})
            queryset = queryset.filter(status=params["status"])
        search = params.get("search", "").strip()
        if search:
            query = Q(user__email__icontains=search)
            # No order-code field exists: numeric search matches the order ID.
            if search.isascii() and search.isdecimal() and len(search) <= 19:
                order_id = int(search)
                if order_id <= 9223372036854775807:
                    query |= Q(pk=order_id)
            queryset = queryset.filter(query)
        return queryset

    @action(detail=True, methods=["patch"], url_path="status")
    def change_status(self, request, pk=None):
        serializer = AdminOrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        with transaction.atomic():
            # Lock only the order, without joining nullable relations or customer rows.
            order = get_object_or_404(Order.objects.select_for_update(), pk=pk)
            self.check_object_permissions(request, order)
            if new_status not in self.transitions.get(order.status, set()):
                raise ValidationError({"status": "Invalid order status transition."})
            order.status = new_status
            order.save(update_fields=["status"])
            result = self.get_queryset().get(pk=order.pk)
            return Response(self.get_serializer(result).data)
