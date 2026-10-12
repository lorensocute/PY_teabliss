from django.urls import path
from .views import (
    ProfileView,
    ChangePasswordView,
    AddressListCreateView,
    AddressDetailView
)

urlpatterns = [
    path('profile', ProfileView.as_view()),
    path('profile/password', ChangePasswordView.as_view()),
    path('profile/addresses', AddressListCreateView.as_view()),
    path('profile/addresses/<int:pk>', AddressDetailView.as_view()),
]