from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Order
from .serializers import CheckoutSerializer, OrderSerializer, OrderStatusUpdateSerializer
from .services import create_order, get_user_order, list_user_orders, update_order_status


class IsActiveAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(
            view is not None
            and user
            and user.is_authenticated
            and user.status == "ACTIVE"
            and user.role == "ADMIN"
        )


class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = list_user_orders(user=request.user)
        return Response(OrderSerializer(orders, many=True).data)

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = create_order(user=request.user, checkout_data=serializer.validated_data)
        order = Order.objects.select_related("promotion").prefetch_related("items__product").get(pk=order.pk)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            order = get_user_order(user=request.user, order_id=pk)
        except Order.DoesNotExist:
            return Response({"detail": "Không tìm thấy đơn hàng."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)


class AdminOrderStatusView(APIView):
    permission_classes = [IsAuthenticated, IsActiveAdmin]

    def put(self, request, pk):
        return self.update_status(request, pk)

    def patch(self, request, pk):
        return self.update_status(request, pk)

    def update_status(self, request, pk):
        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = update_order_status(
                order_id=pk,
                new_status=serializer.validated_data["status"],
            )
        except Order.DoesNotExist as error:
            raise NotFound("Không tìm thấy đơn hàng.") from error
        order = Order.objects.select_related("promotion").prefetch_related("items__product").get(pk=order.pk)
        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)