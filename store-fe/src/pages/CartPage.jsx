import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { toast } from '../components/Toast';
import { getProductImage, handleImageError } from '../utils/imageHelper';
import { formatProductName } from '../utils/categoryHelper';
import './CartPage.css';

/* ─── Mapping Display Labels cho Drink Options ─── */
const SIZE_LABELS = {
  M: 'Size M (350ml)',
  L: 'Size L (500ml)',
  XL: 'Size XL (700ml)',
};

const ICE_LABELS = {
  HOT: 'Nóng',
  LESS_ICE: 'Ít đá',
  NORMAL_ICE: 'Đá vừa',
  FULL_ICE: 'Nhiều đá',
};

function formatSweetness(val) {
  if (val === null || val === undefined) return null;
  if (val === 0) return 'Không ngọt (0%)';
  return `${val}% ngọt`;
}

export default function CartPage() {
  const {
    items,
    totalItems,
    totalPrice,
    removeItem,
    updateQuantity,
    clearCart,
    loading,
  } = useCart();

  const navigate = useNavigate();
  const [updatingItemId, setUpdatingItemId] = useState(null);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `Giỏ Hàng (${totalItems}) | TeaBliss`;
  }, [totalItems]);

  const formatPrice = (price) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0);

  /* ─── Thao tác Số lượng ─── */
  const handleQuantityChange = async (item, newQty) => {
    if (newQty < 1 || updatingItemId === item.id) return;
    setUpdatingItemId(item.id);
    try {
      await updateQuantity(item.id, newQty);
    } finally {
      setUpdatingItemId(null);
    }
  };

  /* ─── Xóa từng Item ─── */
  const handleRemove = async (item) => {
    const confirmMsg = `Bạn muốn xóa "${formatProductName(item.productName)}" khỏi giỏ hàng?`;
    if (window.confirm(confirmMsg)) {
      const success = await removeItem(item.id);
      if (success) {
        toast(`Đã xóa "${formatProductName(item.productName)}" khỏi giỏ hàng`, 'info');
      }
    }
  };

  /* ─── Xóa toàn bộ giỏ hàng ─── */
  const handleClearCart = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) {
      const success = await clearCart();
      if (success) {
        toast('Đã làm trống giỏ hàng', 'info');
      }
    }
  };

  /* ─── Loading State ─── */
  if (loading) {
    return (
      <div className="page-wrapper cart-page">
        <div className="container cart-loading-wrap">
          <div className="spinner" />
          <p>Đang tải giỏ hàng của bạn...</p>
        </div>
      </div>
    );
  }

  /* ─── 9. EMPTY CART STATE ─── */
  if (items.length === 0) {
    return (
      <div className="page-wrapper cart-page">
        {/* Header rút gọn khi trống */}
        <div className="cart-header">
          <div className="container">
            <div className="cart-header__badge">
              <span className="cart-header__dot" />
              <span>GIỎ HÀNG</span>
            </div>
            <h1 className="cart-header__title">Đơn Hàng Của Bạn</h1>
          </div>
        </div>

        <div className="container">
          <div className="cart-empty-card">
            <div className="cart-empty__icon">🛒</div>
            <h2 className="cart-empty__title">Giỏ hàng của bạn đang trống</h2>
            <p className="cart-empty__desc">
              {!user
                ? 'Vui lòng đăng nhập để xem và tiếp tục mua sắm các món đồ uống yêu thích của bạn.'
                : 'Bạn chưa chọn món đồ uống nào. Hãy khám phá thực đơn trà sữa, trà trái cây và cà phê thơm ngon tại TeaBliss nhé!'}
            </p>
            <div className="cart-empty__actions">
              {!user ? (
                <Link to="/login" className="btn btn-primary btn-lg" id="login-cart-btn">
                  Đăng Nhập Ngay
                </Link>
              ) : (
                <Link to="/products" className="btn btn-primary btn-lg" id="go-shopping-btn">
                  Khám Phá Menu Ngay →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper cart-page">
      {/* 1. CART HEADER */}
      <div className="cart-header">
        <div className="container">
          <div className="cart-header__badge">
            <span className="cart-header__dot" />
            <span>GIỎ HÀNG</span>
          </div>
          <div className="cart-header__main">
            <h1 className="cart-header__title">Đơn Hàng Của Bạn</h1>
            <div className="cart-header__meta">
              <span className="cart-header__count-tag">
                {items.length} món • {totalItems} ly đồ uống
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="container cart-body">
        {/* 2 & 3. CART ITEMS LIST */}
        <div className="cart-items-wrapper">
          <div className="cart-items-card">
            <div className="cart-items-card__head">
              <div className="col-prod">Món Đồ Uống</div>
              <div className="col-price">Đơn Giá</div>
              <div className="col-qty">Số Lượng</div>
              <div className="col-total">Thành Tiền</div>
              <div className="col-action"></div>
            </div>

            <div className="cart-items-list">
              {items.map((item, idx) => {
                const itemImg = getProductImage(item);
                // 10. Giá lấy trực tiếp từ backend CartItemResponse (price = unitPrice, lineTotal)
                const unitPrice = item.price ?? item.unitPrice ?? 0;
                const lineTotal = item.lineTotal ?? (unitPrice * item.quantity);
                const hasToppings = item.toppings && item.toppings.length > 0;

                return (
                  <div
                    key={item.id}
                    className="cart-item-row animate-fadeInUp"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                    id={`cart-item-${item.id}`}
                  >
                    {/* Thông tin sản phẩm & Cấu hình chi tiết */}
                    <div className="col-prod cart-item__main">
                      <Link
                        to={`/products/${item.productId}`}
                        className="cart-item__img-link"
                      >
                        <img
                          src={itemImg}
                          alt={formatProductName(item.productName)}
                          className="cart-item__img"
                          onError={handleImageError}
                        />
                      </Link>

                      <div className="cart-item__details">
                        <Link
                          to={`/products/${item.productId}`}
                          className="cart-item__name"
                        >
                          {formatProductName(item.productName)}
                        </Link>

                        {/* 2. CẤU HÌNH ĐỒ UỐNG RÕ RÀNG (Size, Độ ngọt, Đá, Topping) */}
                        <div className="cart-item__options-list">
                          {/* Size */}
                          <span className="option-pill option-pill--size">
                            📐 {SIZE_LABELS[item.size] || `Size ${item.size || 'M'}`}
                          </span>

                          {/* Sweetness (bảo toàn 0 là 'Không ngọt') */}
                          {item.sweetness !== null && item.sweetness !== undefined && (
                            <span className="option-pill option-pill--sweetness">
                              🍬 {formatSweetness(item.sweetness)}
                            </span>
                          )}

                          {/* Ice */}
                          {item.ice && (
                            <span className="option-pill option-pill--ice">
                              🧊 {ICE_LABELS[item.ice] || item.ice}
                            </span>
                          )}

                          {/* Toppings */}
                          <span className={`option-pill ${hasToppings ? 'option-pill--topping' : 'option-pill--none'}`}>
                            🧋 {hasToppings
                              ? item.toppings.map((t) => t.name).join(', ')
                              : 'Không topping'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Đơn giá (Unit Price) từ backend */}
                    <div className="col-price cart-item__price" data-label="Đơn giá:">
                      <span>{formatPrice(unitPrice)}</span>
                    </div>

                    {/* 4. QUANTITY CONTROLS */}
                    <div className="col-qty cart-item__qty" data-label="Số lượng:">
                      <div className="cart-qty-ctrl">
                        <button
                          type="button"
                          className="cart-qty-btn"
                          onClick={() => handleQuantityChange(item, item.quantity - 1)}
                          disabled={item.quantity <= 1 || updatingItemId === item.id}
                          aria-label="Giảm số lượng"
                        >
                          −
                        </button>
                        <span className="cart-qty-val">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-qty-btn"
                          onClick={() => handleQuantityChange(item, item.quantity + 1)}
                          disabled={updatingItemId === item.id}
                          aria-label="Tăng số lượng"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Thành tiền (Line Total) từ backend */}
                    <div className="col-total cart-item__total" data-label="Thành tiền:">
                      <strong>{formatPrice(lineTotal)}</strong>
                    </div>

                    {/* 5. NÚT XÓA TỪNG MÓN */}
                    <div className="col-action cart-item__action">
                      <button
                        type="button"
                        className="cart-item__remove-btn"
                        onClick={() => handleRemove(item)}
                        title={`Xóa ${formatProductName(item.productName)}`}
                        id={`remove-item-${item.id}`}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 6. CLEAR CART & CONTINUE SHOPPING */}
            <div className="cart-items-card__footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-clear-cart"
                onClick={handleClearCart}
                id="clear-all-cart-btn"
              >
                🗑 Xóa toàn bộ giỏ hàng
              </button>

              <Link to="/products" className="btn btn-ghost btn-sm" id="continue-shopping-btn">
                ← Tiếp tục khám phá menu
              </Link>
            </div>
          </div>
        </div>

        {/* 7. ORDER SUMMARY (STICKY TRÊN DESKTOP) */}
        <aside className="cart-summary-sidebar">
          <div className="cart-summary-card">
            <h2 className="cart-summary__title">Tóm Tắt Đơn Hàng</h2>

            <div className="cart-summary__lines">
              <div className="cart-summary__line">
                <span>Số lượng ly:</span>
                <strong>{totalItems} ly đồ uống</strong>
              </div>
              <div className="cart-summary__line">
                <span>Số loại món:</span>
                <strong>{items.length} món</strong>
              </div>
              <div className="cart-summary__line">
                <span>Tạm tính đồ uống:</span>
                <span className="cart-summary__amount">{formatPrice(totalPrice)}</span>
              </div>
              <div className="cart-summary__line">
                <span>Phí vận chuyển:</span>
                <span className="shipping-hint">Xác định khi đặt hàng</span>
              </div>
            </div>

            <div className="cart-summary__divider" />

            {/* TỔNG TIỀN (LẤY THEO TOTAL BACKEND) */}
            <div className="cart-summary__total-row">
              <div>
                <span className="cart-summary__total-label">Tổng thanh toán</span>
                <small className="cart-summary__total-note">(Chưa gồm phí vận chuyển)</small>
              </div>
              <strong className="cart-summary__total-amount">
                {formatPrice(totalPrice)}
              </strong>
            </div>

            {/* 8. CHECKOUT CTA BUTTON */}
            <button
              type="button"
              className="btn btn-primary btn-lg cart-checkout-btn"
              onClick={() => navigate('/checkout')}
              id="proceed-to-checkout-btn"
            >
              Tiến Hành Đặt Hàng →
            </button>

            {/* Cam kết tin cậy */}
            <div className="cart-trust-badges">
              <div className="cart-trust-item">
                <span className="trust-icon">🍵</span>
                <span>Pha chế tươi mới theo yêu cầu</span>
              </div>
              <div className="cart-trust-item">
                <span className="trust-icon">🚀</span>
                <span>Giao nhanh 30 phút giữ lạnh trọn vị</span>
              </div>
              <div className="cart-trust-item">
                <span className="trust-icon">🔒</span>
                <span>Thanh toán an toàn &amp; minh bạch</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
