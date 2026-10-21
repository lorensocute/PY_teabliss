from datetime import timedelta, timezone as datetime_timezone

from django.db.models import DateField, Func
from django.db.models.functions import Cast, TruncDate, TruncMonth


BUSINESS_TIMEZONE = datetime_timezone(timedelta(hours=7))


class RevenuePeriod(Func):
    """Group UTC storage into Vietnamese dates without MySQL timezone tables."""
    output_field = DateField()

    def __init__(self, expression, group_by):
        self.group_by = group_by
        super().__init__(expression)

    def as_mysql(self, compiler, connection, **extra_context):
        sql, params = compiler.compile(self.source_expressions[0])
        converted = f"CONVERT_TZ({sql}, %s, %s)"
        params = (*params, "+00:00", "+07:00")
        if self.group_by == "day":
            return f"DATE({converted})", params
        return f"CAST(DATE_FORMAT({converted}, %s) AS DATE)", (*params, "%Y-%m-01")

    def as_sql(self, compiler, connection, **extra_context):
        expression = self.source_expressions[0]
        if self.group_by == "day":
            group = TruncDate(expression, tzinfo=BUSINESS_TIMEZONE)
        else:
            group = Cast(TruncMonth(expression, tzinfo=BUSINESS_TIMEZONE), DateField())
        return compiler.compile(group)
