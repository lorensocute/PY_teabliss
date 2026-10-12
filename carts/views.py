from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer
from products.models import Product


# Xem giỏ hàng
class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, _ = Cart.objects.get_or_create(
            user=request.user
        )

        serializer = CartSerializer(cart)
        return Response(serializer.data)


# Thêm sản phẩm vào giỏ hàng
class AddCartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        product_id = request.data.get('product')
        quantity = request.data.get('quantity', 1)

        try:
            quantity = int(quantity)
            if quantity <= 0:
                return Response(
                    {'error': 'Số lượng phải lớn hơn 0.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Số lượng không hợp lệ.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not product_id:
            return Response(
                {'error': 'Vui lòng cung cấp mã sản phẩm.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(pk=product_id, status='ACTIVE', category__status='ACTIVE')
        except (Product.DoesNotExist, ValueError, TypeError):
            return Response(
                {'error': 'Sản phẩm không tồn tại hoặc hiện không được bán.'},
                status=status.HTTP_404_NOT_FOUND
            )

        cart, _ = Cart.objects.get_or_create(user=request.user)
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            defaults={'quantity': quantity}
        )

        if not created:
            item.quantity += quantity
            item.save(update_fields=['quantity'])

        return Response(
            CartItemSerializer(item).data,
            status=status.HTTP_201_CREATED
        )


# Sửa số lượng sản phẩm
class UpdateCartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            item = CartItem.objects.get(
                id=pk,
                cart__user=request.user
            )
        except CartItem.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy sản phẩm trong giỏ hàng.'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            quantity = int(request.data.get('quantity'))
            if quantity <= 0:
                return Response(
                    {'error': 'Số lượng phải lớn hơn 0.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Số lượng không hợp lệ.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        item.quantity = quantity
        item.save()

        return Response(CartItemSerializer(item).data)


# Xóa sản phẩm khỏi giỏ hàng
class DeleteCartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            item = CartItem.objects.get(
                id=pk,
                cart__user=request.user
            )
        except CartItem.DoesNotExist:
            return Response(
                {'error': 'Không tìm thấy sản phẩm trong giỏ hàng.'},
                status=status.HTTP_404_NOT_FOUND
            )

        item.delete()

        return Response(
            {'message': 'Xóa sản phẩm thành công.'},
            status=status.HTTP_200_OK
        )