from django.urls import path
from .views import (
    CartView,
    AddCartItemView,
    UpdateCartItemView,
    DeleteCartItemView
)

urlpatterns = [
    path('cart/', CartView.as_view()),
    path('cart/add/', AddCartItemView.as_view()),
    path('cart/update/<int:pk>/', UpdateCartItemView.as_view()),
    path('cart/delete/<int:pk>/', DeleteCartItemView.as_view()),
]