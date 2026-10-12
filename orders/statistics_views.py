from datetime import datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from products.models import Product
from products.permissions import IsActiveAdmin
from .models import Order, OrderItem
from .statistics_expressions import BUSINESS_TIMEZONE, RevenuePeriod


class StatisticsQuerySerializer(serializers.Serializer):
    start_date = serializers.DateField(input_formats=["%Y-%m-%d"], required=False)
    end_date = serializers.DateField(input_formats=["%Y-%m-%d"], required=False)
    group_by = serializers.ChoiceField(choices=["day", "month"], default="day")
    limit = serializers.IntegerField(min_value=1, max_value=100, default=10)

    def validate(self, attrs):
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if start and end and start > end:
            raise serializers.ValidationError({"end_date": "Must be on or after start_date."})
        if end and end.year == 9999 and end.month == 12 and end.day == 31:
            raise serializers.ValidationError({"end_date": "Date is outside the supported range."})
        return attrs


def filtered_orders(params):
    queryset = Order.objects.all()
    tz = BUSINESS_TIMEZONE
    if params.get("start_date"):
        start = timezone.make_aware(datetime.combine(params["start_date"], time.min), tz)
        queryset = queryset.filter(created_at__gte=start)
    if params.get("end_date"):
        end = timezone.make_aware(datetime.combine(params["end_date"] + timedelta(days=1), time.min), tz)
        queryset = queryset.filter(created_at__lt=end)
    return queryset


def money(value):
    # Preserve Decimal arithmetic while emitting strings, like existing money fields.
    return format(value if value is not None else Decimal("0"), ".2f")


class StatisticsView(APIView):
    permission_classes = [IsActiveAdmin]
    http_method_names = ["get", "head", "options"]

    def parameters(self, request):
        serializer = StatisticsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data


class OverviewStatisticsView(StatisticsView):
    def get(self, request):
        orders = filtered_orders(self.parameters(request))
        totals = orders.aggregate(order_count=Count("id"), revenue=Sum("total_amount", filter=Q(status="COMPLETED")))
        return Response({
            "total_revenue": money(totals["revenue"]), "order_count": totals["order_count"],
            "customer_count": get_user_model().objects.filter(role="CUSTOMER").count(),
            "product_count": Product.objects.count(),
        })


class RevenueStatisticsView(StatisticsView):
    def get(self, request):
        params = self.parameters(request)
        orders = filtered_orders(params).filter(status="COMPLETED")
        group = RevenuePeriod("created_at", params["group_by"])
        # Return at most 366 newest buckets, then sort chronologically for charts.
        rows = list(orders.order_by().annotate(period=group).values("period").annotate(
            revenue=Sum("total_amount"), order_count=Count("id")
        ).order_by("-period")[:367])
        truncated = len(rows) > 366
        rows = rows[:366]
        rows.reverse()
        return Response({"group_by": params["group_by"], "truncated": truncated, "results": [
            {"period": row["period"].strftime("%Y-%m-%d" if params["group_by"] == "day" else "%Y-%m"),
             "revenue": money(row["revenue"]), "order_count": row["order_count"]} for row in rows
        ]})


class OrderStatisticsView(StatisticsView):
    def get(self, request):
        rows = filtered_orders(self.parameters(request)).order_by().values("status").annotate(count=Count("id"))
        counts = {row["status"]: row["count"] for row in rows}
        return Response({"results": [{"status": value, "count": counts.get(value, 0)}
                                     for value, _ in Order._meta.get_field("status").choices]})


class ProductStatisticsView(StatisticsView):
    def get(self, request):
        params = self.parameters(request)
        orders = filtered_orders(params).filter(status="COMPLETED")
        rows = OrderItem.objects.filter(order__in=orders).values("product_id", "product__name").annotate(
            quantity_sold=Sum("quantity")
        ).order_by("-quantity_sold", "product_id")[:params["limit"]]
        return Response({"results": [{"product_id": row["product_id"], "name": row["product__name"],
                                      "quantity_sold": row["quantity_sold"]} for row in rows]})
