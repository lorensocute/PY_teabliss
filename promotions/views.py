from django.db import IntegrityError, transaction
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed, ValidationError
from rest_framework.response import Response

from products.permissions import IsActiveAdmin
from products.pagination import OptionalPageNumberPagination
from .models import Promotion
from .serializers import PromotionSerializer, PromotionStatusSerializer


class PromotionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin,
    mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet,
):
    queryset = Promotion.objects.all().order_by("id")
    serializer_class = PromotionSerializer
    pagination_class = OptionalPageNumberPagination
    # No publication flag exists: do not expose internal codes to public callers.
    permission_classes = [IsActiveAdmin]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def _save(self, serializer):
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            # The existing unique constraint also guards concurrent normalized writes.
            raise ValidationError({"code": "This promotion code already exists."})

    def perform_create(self, serializer):
        self._save(serializer)

    def perform_update(self, serializer):
        self._save(serializer)

    def partial_update(self, request, *args, **kwargs):
        raise MethodNotAllowed("PATCH")

    @action(detail=True, methods=["patch"], url_path="status")
    def change_status(self, request, pk=None):
        promotion = self.get_object()
        serializer = PromotionStatusSerializer(promotion, data=request.data)
        serializer.is_valid(raise_exception=True)
        promotion.status = serializer.validated_data["status"]
        promotion.save(update_fields=["status"])
        return Response(self.get_serializer(promotion).data)
