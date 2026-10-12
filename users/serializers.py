
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
User = get_user_model()
'''
    Register
'''
class RegisterSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password]
    )

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'password']

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "Email đã tồn tại"
            )
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')

        user = User.objects.create_user(
            password=password,
            **validated_data
        )

        return user
'''
    Login
'''
class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(
            email=data['email'],
            password=data['password']
        )

        if user is None:
            raise serializers.ValidationError(
                "Email hoặc mật khẩu không đúng"
            )

        if user.status != 'ACTIVE':
            raise serializers.ValidationError(
                "Tài khoản đã bị khóa"
            )

        data['user'] = user
        return data