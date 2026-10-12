from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsActiveAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user

        return (
            user.is_authenticated
            and user.is_active
            and getattr(user, "status", None) == "ACTIVE"
            and getattr(user, "role", None) == "ADMIN"
        )


class IsAdminOrReadOnly(IsActiveAdmin):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or super().has_permission(request, view)
