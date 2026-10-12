from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from products.permissions import IsActiveAdmin
from .admin_serializers import AdminUserSerializer, AdminUserStatusSerializer


class AdminUserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = get_user_model().objects.only(
        "id", "email", "full_name", "phone", "role", "status", "is_active", "is_superuser"
    ).order_by("id")
    serializer_class = AdminUserSerializer
    permission_classes = [IsActiveAdmin]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        params = self.request.query_params
        for field, choices in (("role", ("ADMIN", "CUSTOMER")), ("status", ("ACTIVE", "INACTIVE"))):
            if field in params:
                if params[field] not in choices:
                    raise ValidationError({field: "Invalid filter value."})
                queryset = queryset.filter(**{field: params[field]})
        search = params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(email__icontains=search) | Q(full_name__icontains=search))
        return queryset

    @action(detail=True, methods=["patch"], url_path="status")
    def change_status(self, request, pk=None):
        serializer = AdminUserStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        with transaction.atomic():
            user = get_object_or_404(self.get_queryset().select_for_update(), pk=pk)
            self.check_object_permissions(request, user)
            if new_status == "INACTIVE":
                if user.pk == request.user.pk:
                    raise ValidationError({"status": "You cannot lock your own account."})
                if user.is_superuser:
                    raise ValidationError({"status": "Superusers cannot be locked through this API."})
            user.status = new_status
            user.is_active = new_status == "ACTIVE"
            user.save(update_fields=["status", "is_active"])
        return Response(self.get_serializer(user).data)
