from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("products.urls")),
    path("api/", include("promotions.urls")),
    path("api/admin/", include("users.admin_urls")),
    path("api/admin/", include("orders.admin_urls")),
    path("api/admin/statistics/", include("orders.statistics_urls")),
]
