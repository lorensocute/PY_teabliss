from django.urls import path

from .statistics_views import (
    OverviewStatisticsView, RevenueStatisticsView, OrderStatisticsView, ProductStatisticsView,
)

urlpatterns = [
    path("overview", OverviewStatisticsView.as_view(), name="statistics-overview"),
    path("revenue", RevenueStatisticsView.as_view(), name="statistics-revenue"),
    path("orders", OrderStatisticsView.as_view(), name="statistics-orders"),
    path("products", ProductStatisticsView.as_view(), name="statistics-products"),
]
