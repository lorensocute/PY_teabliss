import re

from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination


class OptionalPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def paginate_queryset(self, queryset, request, view=None):
        if not any(key in request.query_params for key in ("page", "page_size")):
            return None
        for key in ("page", "page_size"):
            if key in request.query_params:
                value = request.query_params[key]
                if not re.fullmatch(r"[0-9]+", value) or len(value) > 10 or int(value) < 1:
                    raise ValidationError({key: "Must be a positive integer."})
                if key == "page_size" and int(value) > self.max_page_size:
                    raise ValidationError({key: "Must not exceed 100."})
        return super().paginate_queryset(queryset, request, view)
