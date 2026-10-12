from django.contrib.auth import get_user_model
from rest_framework import serializers


class AdminUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ["id", "email", "full_name", "phone", "role", "status"]
        read_only_fields = fields


class AdminUserStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ACTIVE", "INACTIVE"])

    def to_internal_value(self, data):
        if hasattr(data, "keys"):
            unexpected = set(data.keys()) - {"status"}
            if unexpected:
                raise serializers.ValidationError({
                    field: "Only status may be updated." for field in sorted(unexpected)
                })
        return super().to_internal_value(data)
