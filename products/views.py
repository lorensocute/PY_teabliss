
from django.db.models import Q

from rest_framework import mixins, serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import MethodNotAllowed, ValidationError

from .models import Category, Product
from .serializers import (
    CategorySerializer,
    CategoryStatusSerializer,
    ProductSerializer,
    ProductStatusSerializer,
)
from .permissions import IsActiveAdmin, IsAdminOrReadOnly
from .pagination import OptionalPageNumberPagination


class CategoryViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Category.objects.all().order_by("id")
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = OptionalPageNumberPagination

    http_method_names = [
        "get", "post", "put", "patch", "head", "options"
    ]

    def get_queryset(self):
        queryset = super().get_queryset()

        if not IsActiveAdmin().has_permission(self.request, self):
            queryset = queryset.filter(status="ACTIVE")

        return queryset

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed("PATCH")

    @action(detail=True, methods=["patch"], url_path="status")
    def change_status(self, request, pk=None):
        category = self.get_object()

        serializer = CategoryStatusSerializer(
            category,
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        category.status = serializer.validated_data["status"]
        category.save(update_fields=["status"])

        return Response(
            self.get_serializer(category).data,
            status=status.HTTP_200_OK
        )


class ProductViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Product.objects.select_related("category").order_by("id")
    serializer_class = ProductSerializer
    pagination_class = OptionalPageNumberPagination
    permission_classes = [IsAdminOrReadOnly]

    http_method_names = [
        "get", "post", "put", "patch", "head", "options"
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        if not IsActiveAdmin().has_permission(self.request, self):
            queryset = queryset.filter(
                status="ACTIVE",
                category__status="ACTIVE"
            )

        if self.action != "list":
            return queryset

        params = self.request.query_params
        if "category_id" in params:
            field = serializers.IntegerField(
                min_value=1,
                max_value=9223372036854775807
            )
            try:
                value = field.run_validation(params["category_id"])
            except ValidationError as exc:
                raise ValidationError({"category_id": exc.detail})

            queryset = queryset.filter(category_id=value)
        if "category" in params:
            try:
                category_id = int(params["category"])
            except (ValueError, TypeError):
                raise ValidationError({
                    "category": "ID danh muc phai la so nguyen."
                })

            queryset = queryset.filter(category_id=category_id)

        # Loc theo trang thai
        if "status" in params:
            if params["status"] not in ("ACTIVE", "INACTIVE"):
                raise ValidationError({
                    "status": "Trang thai phai la ACTIVE hoac INACTIVE."
                })

            queryset = queryset.filter(status=params["status"])

        # Tim kiem theo search (nhanh thu)
        if params.get("search"):
            queryset = queryset.filter(
                name__icontains=params["search"].strip()
            )

        # Tim kiem theo q (nhanh chi)
        if params.get("q"):
            keyword = params["q"].strip()

            queryset = queryset.filter(
                Q(name__icontains=keyword)
                | Q(description__icontains=keyword)
                | Q(category__name__icontains=keyword)
            )
        if "ordering" in params:
            ordering = params["ordering"]

            if ordering not in ("price", "-price"):
                raise ValidationError({
                    "ordering": "Chi ho tro price hoac -price."
                })

            queryset = queryset.order_by(ordering, "id")

        return queryset

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed("PATCH")

    @action(detail=True, methods=["patch"], url_path="status")
    def change_status(self, request, pk=None):
        product = self.get_object()

        serializer = ProductStatusSerializer(
            product,
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        product.status = serializer.validated_data["status"]
        product.save(update_fields=["status"])

        return Response(self.get_serializer(product).data)
