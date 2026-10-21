from rest_framework.routers import DefaultRouter

from .views import PromotionViewSet

router = DefaultRouter(trailing_slash=False)
router.register("promotions", PromotionViewSet, basename="promotion")
urlpatterns = router.urls
