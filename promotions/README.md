# Promotion

All Promotion endpoints require an authenticated, active user with role ADMIN.
The model has no publication flag, so list/detail responses are not public.
Category/Product GET permissions remain unchanged.

- GET/POST `/api/promotions`
- GET/PUT `/api/promotions/{id}`
- PATCH `/api/promotions/{id}/status` with `{"status": "ACTIVE"}` or `INACTIVE`
- DELETE and ordinary PATCH return 405 for authorized callers.

Payload fields follow the existing model: `code`, `discount_type` (`PERCENT` or
`FIXED`), `discount_value`, `minimum_order_value`, `start_date`, `end_date`,
and `status`. Send money as decimal strings and timestamps with timezone offsets.
Codes are trimmed, uppercased and checked case-insensitively for uniqueness.
Existing database rows are not rewritten.

## Reusable calculation

```python
from decimal import Decimal
from promotions.services import apply_promotion, PromotionError

try:
    result = apply_promotion("tea10", Decimal("100000.00"))
except PromotionError as exc:
    error_code = exc.code
else:
    discount = result.discount_amount
    total = result.total_after_discount
```

The service reads the promotion and does not create/update orders or promotions.
`subtotal` represents merchandise value before discount; it must be a finite,
nonnegative Decimal with at most two decimal places and at most 15 total digits,
matching Order totals. Promotion discount values retain their 12-digit limit.
Optional `at` must be timezone-aware; the default is `timezone.now()`.
Start/end instants are inclusive. Discounts round HALF_UP to two decimal places
and cannot exceed subtotal. `minimum_order_value` is the model's minimum order
threshold. Checkout integration should revalidate against the final subtotal and
time when it is implemented.

Run regression tests without MySQL:

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test products promotions --settings=products.test_settings
```
