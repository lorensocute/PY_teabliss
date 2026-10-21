from rest_framework.routers import DefaultRouter

from .admin_views import AdminOrderViewSet

router = DefaultRouter(trailing_slash=False)
router.register("orders", AdminOrderViewSet, basename="admin-order")
urlpatterns = router.urls
