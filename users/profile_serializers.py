from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import Address

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'role']
        read_only_fields = ['id', 'email', 'role']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mật khẩu cũ không đúng")
        return value

    def validate_new_password(self, value):
        validate_password(value, self.context['request'].user)
        return value


class AddressSerializer(serializers.ModelSerializer):
    recipient_name = serializers.CharField(source='receiver_name')
    province = serializers.CharField(source='city')
    detail_address = serializers.CharField(source='address_detail')
    is_default = serializers.BooleanField(source='default_address')

    class Meta:
        model = Address
        fields = [
            'id', 'recipient_name', 'phone', 'province',
            'district', 'ward', 'detail_address', 'is_default'
        ]