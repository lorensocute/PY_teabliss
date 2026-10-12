from django.urls import path

from .views import AdminOrderStatusView, OrderDetailView, OrderListCreateView


urlpatterns = [
    path("orders/", OrderListCreateView.as_view(), name="order-list-create"),
    path("orders/<int:pk>/", OrderDetailView.as_view(), name="order-detail"),
    path("admin/orders/<int:pk>/status/", AdminOrderStatusView.as_view(), name="admin-order-status"),
]