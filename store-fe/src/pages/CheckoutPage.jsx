import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { toast } from '../components/Toast';
import './CheckoutPage.css';

import { getProductImage, handleImageError } from '../utils/imageHelper';

const PAYMENT_METHODS = [
  {
    id: 'cod',
    label: 'Thanh Toán Khi Nhận Hàng (COD)',
    icon: '💵',
    desc: 'Thanh toán bằng tiền mặt khi nhận hàng',
  },
];

const STEPS = ['Giỏ Hàng', 'Thông Tin', 'Xác Nhận'];

export default function CheckoutPage() {
  const { items, totalPrice, fetchCart, loading: cartLoading } = useCart();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: form, 2: confirm, 3: success
  const [payment] = useState('cod'); // Only COD supported
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);

  // Saved Addresses state
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [useCustomAddress, setUseCustomAddress] = useState(false);

  // Promotion state
  const [promotionCode, setPromotionCode] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    ward: '',
    district: '',
    city: 'TP. Hồ Chí Minh',
    note: '',
  });

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  })();

  // Auth check & load addresses
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Thanh Toán | TeaBliss';

    if (!user) {
      toast('Vui lòng đăng nhập để thanh toán', 'warning');
      navigate('/login');
      return;
    }

    // Load user's saved addresses
    api.getAddresses()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setSavedAddresses(list);
          const def = list.find((a) => a.defaultAddress) || list[0];
          setSelectedAddressId(def.id);
          setUseCustomAddress(false);
          setForm((prev) => ({
            ...prev,
            name: def.receiverName || user.fullName || '',
            phone: def.phone || '',
            address: def.addressDetail || '',
            ward: def.ward || '',
            district: def.district || '',
            city: def.city || 'TP. Hồ Chí Minh',
          }));
        } else {
          setUseCustomAddress(true);
          if (user.fullName) {
            setForm((prev) => ({ ...prev, name: user.fullName }));
          }
        }
      })
      .catch(() => {
        setUseCustomAddress(true);
        if (user.fullName) {
          setForm((prev) => ({ ...prev, name: user.fullName }));
        }
      });
  }, [navigate]);

  const FREESHIP_THRESHOLD = 150000;
  const shippingFee = totalPrice >= FREESHIP_THRESHOLD ? 0 : 25000;
  const grandTotal = totalPrice + shippingFee;

  const formatPrice = (price) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price ?? 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const applySavedAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setUseCustomAddress(false);
    setForm((prev) => ({
      ...prev,
      name: addr.receiverName || '',
      phone: addr.phone || '',
      address: addr.addressDetail || '',
      ward: addr.ward || '',
      district: addr.district || '',
      city: addr.city || 'TP. Hồ Chí Minh',
    }));
    setErrors({});
  };

  const getShippingAddress = () => {
    return [form.address, form.ward, form.district, form.city]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', ');
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Vui lòng nhập họ và tên người nhận';
    if (!form.phone.trim() || !/^(0[3|5|7|8|9])\d{8}$/.test(form.phone.trim())) {
      errs.phone = 'Số điện thoại không hợp lệ (VD: 0901234567)';
    }
    if (!form.address.trim()) errs.address = 'Vui lòng nhập số nhà, tên đường';
    if (!form.district.trim()) errs.district = 'Vui lòng nhập quận/huyện';
    if (!form.city.trim()) errs.city = 'Vui lòng nhập tỉnh/thành phố';
    return errs;
  };

  const handleNextStep = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast('Vui lòng kiểm tra lại thông tin nhận hàng!', 'error');
      return;
    }
    setStep(2);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setStep(1);
      toast('Vui lòng kiểm tra lại thông tin nhận hàng!', 'error');
      return;
    }

    const shippingAddr = getShippingAddress();
    if (!shippingAddr) {
      toast('Địa chỉ giao hàng không được để trống!', 'error');
      return;
    }

    if (items.length === 0) {
      toast('Giỏ hàng trống, không thể đặt hàng!', 'error');
      navigate('/cart');
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        receiverName: form.name.trim(),
        receiverPhone: form.phone.trim(),
        shippingAddress: shippingAddr,
        promotionCode: promotionCode.trim() || null,
      };

      const res = await api.createOrder(orderPayload);
      setCreatedOrder(res);

      // Backend has cleared the cart in DB. Re-sync frontend CartContext to zero.
      await fetchCart();

      toast('🎉 Đặt hàng thành công!', 'success');
      setStep(3);
      window.scrollTo(0, 0);
    } catch (err) {
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('đăng nhập')) {
        toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
        navigate('/login');
      } else {
        toast(err.message || 'Đặt hàng thất bại. Vui lòng thử lại!', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (cartLoading && items.length === 0 && step !== 3) {
    return (
      <div className="page-wrapper checkout-page">
        <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Empty cart state (only if not on success step)
  if (items.length === 0 && step !== 3) {
    return (
      <div className="page-wrapper">
        <div className="container" style={{ paddingTop: 'calc(var(--navbar-height) + 60px)', paddingBottom: '60px' }}>
          <div className="empty-state">
            <div className="empty-state__icon">🛒</div>
            <h2 className="empty-state__title">Giỏ Hàng Trống</h2>
            <p className="empty-state__desc">Hãy thêm sản phẩm vào giỏ hàng trước khi thanh toán!</p>
            <Link to="/products" className="btn btn-primary btn-lg" id="go-shopping-from-checkout">
              Xem Thực Đơn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Success Page
  if (step === 3 && createdOrder) {
    return (
      <div className="page-wrapper">
        <div className="container checkout-success" style={{ paddingTop: 'calc(var(--navbar-height) + 40px)', paddingBottom: '80px' }}>
          <div className="success-card glass-card animate-scaleIn">
            <div className="success-card__icon animate-float">🎉</div>
            <h2 className="success-card__title">Đặt Hàng Thành Công!</h2>
            <p className="success-card__desc">
              Cảm ơn bạn đã tin tưởng TeaBliss! Đơn hàng của bạn đã được tiếp nhận và đang được xử lý.
            </p>
            <div className="success-card__order-id">
              <span>Mã đơn hàng:</span>
              <strong>#{createdOrder.id}</strong>
            </div>

            <div className="success-card__info">
              <div className="success-info-item">
                <span>👤</span>
                <div>
                  <strong>{createdOrder.receiverName}</strong>
                  <p>{createdOrder.receiverPhone}</p>
                </div>
              </div>
              <div className="success-info-item">
                <span>📍</span>
                <div>
                  <strong>Địa chỉ giao hàng</strong>
                  <p>{createdOrder.shippingAddress}</p>
                </div>
              </div>
              <div className="success-info-item">
                <span>💵</span>
                <div>
                  <strong>Phương thức thanh toán</strong>
                  <p>Thanh toán khi nhận hàng (COD)</p>
                </div>
              </div>
              <div className="success-info-item">
                <span>💰</span>
                <div>
                  <strong>Tổng thanh toán</strong>
                  <p style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '1.05rem' }}>
                    {formatPrice(createdOrder.totalAmount)}
                  </p>
                  {createdOrder.discountAmount > 0 && (
                    <small style={{ color: 'var(--color-success)' }}>
                      (Đã giảm: {formatPrice(createdOrder.discountAmount)})
                    </small>
                  )}
                </div>
              </div>
              <div className="success-info-item">
                <span>⏱</span>
                <div>
                  <strong>Trạng thái</strong>
                  <p>
                    <span className="badge badge-gold">
                      {createdOrder.status === 'PENDING' ? '⏳ Chờ xác nhận (PENDING)' : createdOrder.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="success-card__actions">
              <Link to="/orders" className="btn btn-primary btn-lg" id="view-orders-btn">
                📦 Xem Đơn Hàng Của Tôi
              </Link>
              <Link to="/" className="btn btn-ghost btn-lg" id="back-home-success">
                🏠 Về Trang Chủ
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper checkout-page">
      {/* Header with Steps */}
      <div className="checkout-header">
        <div className="container">
          <h1 className="heading-xl" style={{ marginBottom: 'var(--space-xl)' }}>Thanh Toán</h1>
          <div className="checkout-steps">
            {STEPS.map((label, i) => (
              <div key={i} className={`checkout-step ${i < step ? 'done' : i === step - 1 ? 'active' : ''}`}>
                <div className="checkout-step__num">{i < step - 1 ? '✓' : i + 1}</div>
                <span>{label}</span>
                {i < STEPS.length - 1 && <div className="checkout-step__line" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container checkout-body">
        {/* Left: Form or Confirm */}
        <div className="checkout-form-wrap">
          {step === 1 ? (
            <>
              {/* Delivery Address & Contact Info */}
              <div className="checkout-section glass-card">
                <h3 className="checkout-section__title">📍 Địa Chỉ Giao Hàng</h3>

                {/* Saved Address Selector */}
                {savedAddresses.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-xl)' }}>
                    <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 600 }}>
                      Chọn từ sổ địa chỉ đã lưu:
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {savedAddresses.map((addr) => {
                        const isSelected = !useCustomAddress && selectedAddressId === addr.id;
                        return (
                          <div
                            key={addr.id}
                            className={`payment-method ${isSelected ? 'active' : ''}`}
                            onClick={() => applySavedAddress(addr)}
                            style={{ cursor: 'pointer', padding: '12px 16px' }}
                          >
                            <span className="payment-method__icon" style={{ fontSize: '1.2rem' }}>📍</span>
                            <div className="payment-method__info">
                              <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {addr.receiverName} ({addr.phone})
                                {addr.defaultAddress && (
                                  <span className="badge badge-gold" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Mặc định</span>
                                )}
                              </strong>
                              <p style={{ marginTop: '2px' }}>
                                {[addr.addressDetail, addr.ward, addr.district, addr.city].filter(Boolean).join(', ')}
                              </p>
                            </div>
                            <div className="payment-method__radio" />
                          </div>
                        );
                      })}

                      <div
                        className={`payment-method ${useCustomAddress ? 'active' : ''}`}
                        onClick={() => {
                          setUseCustomAddress(true);
                          setSelectedAddressId(null);
                          setForm((prev) => ({
                            ...prev,
                            address: '',
                            ward: '',
                            district: '',
                          }));
                        }}
                        style={{ cursor: 'pointer', padding: '12px 16px' }}
                      >
                        <span className="payment-method__icon" style={{ fontSize: '1.2rem' }}>✏️</span>
                        <div className="payment-method__info">
                          <strong>Nhập địa chỉ khác / trực tiếp</strong>
                          <p>Tự điền thông tin người nhận và địa chỉ giao hàng bên dưới</p>
                        </div>
                        <div className="payment-method__radio" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Address Form Inputs */}
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-name">Họ và Tên Người Nhận *</label>
                    <input
                      id="checkout-name"
                      name="name"
                      type="text"
                      className={`form-input ${errors.name ? 'error' : ''}`}
                      placeholder="Nguyễn Văn A"
                      value={form.name}
                      onChange={handleChange}
                    />
                    {errors.name && <span className="form-error">{errors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-phone">Số Điện Thoại *</label>
                    <input
                      id="checkout-phone"
                      name="phone"
                      type="tel"
                      className={`form-input ${errors.phone ? 'error' : ''}`}
                      placeholder="0901 234 567"
                      value={form.phone}
                      onChange={handleChange}
                    />
                    {errors.phone && <span className="form-error">{errors.phone}</span>}
                  </div>

                  <div className="form-group form-grid__full">
                    <label className="form-label" htmlFor="checkout-address">Số Nhà, Tên Đường *</label>
                    <input
                      id="checkout-address"
                      name="address"
                      type="text"
                      className={`form-input ${errors.address ? 'error' : ''}`}
                      placeholder="123 Đường Nguyễn Huệ"
                      value={form.address}
                      onChange={handleChange}
                    />
                    {errors.address && <span className="form-error">{errors.address}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-ward">Phường / Xã</label>
                    <input
                      id="checkout-ward"
                      name="ward"
                      type="text"
                      className="form-input"
                      placeholder="Phường Bến Nghé"
                      value={form.ward}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="checkout-district">Quận / Huyện *</label>
                    <input
                      id="checkout-district"
                      name="district"
                      type="text"
                      className={`form-input ${errors.district ? 'error' : ''}`}
                      placeholder="Quận 1"
                      value={form.district}
                      onChange={handleChange}
                    />
                    {errors.district && <span className="form-error">{errors.district}</span>}
                  </div>

                  <div className="form-group form-grid__full">
                    <label className="form-label" htmlFor="checkout-city">Tỉnh / Thành Phố *</label>
                    <input
                      id="checkout-city"
                      name="city"
                      type="text"
                      className={`form-input ${errors.city ? 'error' : ''}`}
                      placeholder="TP. Hồ Chí Minh"
                      value={form.city}
                      onChange={handleChange}
                    />
                    {errors.city && <span className="form-error">{errors.city}</span>}
                  </div>

                  <div className="form-group form-grid__full">
                    <label className="form-label" htmlFor="checkout-note">Ghi chú đơn hàng (tùy chọn)</label>
                    <textarea
                      id="checkout-note"
                      name="note"
                      className="form-input"
                      placeholder="Ghi chú thêm (VD: giao trước 17h, ít đá...)"
                      value={form.note}
                      onChange={handleChange}
                      rows={2}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="checkout-section glass-card">
                <h3 className="checkout-section__title">💳 Phương Thức Thanh Toán</h3>
                <div className="payment-methods">
                  {PAYMENT_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`payment-method ${payment === m.id ? 'active' : ''}`}
                      htmlFor={`payment-${m.id}`}
                    >
                      <input
                        type="radio"
                        id={`payment-${m.id}`}
                        name="payment"
                        value={m.id}
                        checked={payment === m.id}
                        readOnly
                      />
                      <span className="payment-method__icon">{m.icon}</span>
                      <div className="payment-method__info">
                        <strong>{m.label}</strong>
                        <p>{m.desc}</p>
                      </div>
                      <div className="payment-method__radio" />
                    </label>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleNextStep}
                id="next-step-btn"
              >
                Xem Lại Đơn Hàng →
              </button>
            </>
          ) : (
            /* Step 2: Confirm */
            <div className="checkout-confirm glass-card">
              <h3 className="checkout-section__title">✅ Xác Nhận Đơn Hàng</h3>

              <div className="confirm-section">
                <h4>Thông Tin Giao Hàng</h4>
                <div className="confirm-info">
                  <p><strong>Người nhận:</strong> {form.name}</p>
                  <p><strong>Điện thoại:</strong> {form.phone}</p>
                  <p><strong>Địa chỉ giao hàng:</strong> {getShippingAddress()}</p>
                  {promotionCode.trim() && (
                    <p><strong>Mã khuyến mãi:</strong> <span className="badge badge-gold">{promotionCode.trim()}</span></p>
                  )}
                  {form.note && <p><strong>Ghi chú:</strong> {form.note}</p>}
                </div>
              </div>

              <div className="confirm-section">
                <h4>Phương Thức Thanh Toán</h4>
                <p>💵 Thanh Toán Khi Nhận Hàng (COD)</p>
              </div>

              <div className="confirm-section">
                <h4>Sản Phẩm ({items.length})</h4>
                {items.map((item) => {
                  const itemId = item.id || item.itemKey;
                  const itemImg = getProductImage(item);
                  const itemName = item.productName || item.product?.name || 'Sản phẩm';
                  const unitPrice = item.price ?? item.unitPrice ?? 0;
                  const subtotal = item.lineTotal ?? (unitPrice * item.quantity);

                  return (
                    <div key={itemId} className="confirm-item">
                      <img
                        src={itemImg}
                        alt={itemName}
                        className="confirm-item__img"
                        onError={handleImageError}
                      />
                      <div className="confirm-item__info">
                        <strong>{itemName}</strong>
                        <p>Số lượng: x{item.quantity}</p>
                      </div>
                      <strong className="confirm-item__price">{formatPrice(subtotal)}</strong>
                    </div>
                  );
                })}
              </div>

              <div className="confirm-total">
                <div className="confirm-total__row">
                  <span>Tạm tính</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="confirm-total__row">
                  <span>Phí vận chuyển</span>
                  <span className={shippingFee === 0 ? 'free-text' : ''}>
                    {shippingFee === 0 ? 'Miễn phí 🎉' : formatPrice(shippingFee)}
                  </span>
                </div>
                <div className="confirm-total__row confirm-total__grand">
                  <span>Tổng Thanh Toán</span>
                  <strong>{formatPrice(grandTotal)}</strong>
                </div>
                {promotionCode.trim() && (
                  <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '6px' }}>
                    * Giá trị giảm từ mã [{promotionCode.trim()}] sẽ được hệ thống áp dụng tự động khi đặt hàng.
                  </small>
                )}
              </div>

              <div className="confirm-actions">
                <button
                  className="btn btn-ghost btn-lg"
                  onClick={() => { setStep(1); window.scrollTo(0, 0); }}
                  id="back-to-form-btn"
                  disabled={submitting}
                >
                  ← Quay Lại
                </button>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleSubmit}
                  disabled={submitting}
                  id="place-order-btn"
                >
                  {submitting ? (
                    <><span className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> Đang Tạo Đơn Hàng...</>
                  ) : '🎉 Đặt Hàng Ngay'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Order Summary */}
        <div className="checkout-summary">
          <div className="glass-card checkout-summary__card">
            <h3 className="checkout-summary__title">Đơn Hàng Của Bạn</h3>
            <div className="checkout-summary__items">
              {items.map((item) => {
                const itemId = item.id || item.itemKey;
                const itemImg = getProductImage(item);
                const itemName = item.productName || item.product?.name || 'Sản phẩm';
                const unitPrice = item.price ?? item.unitPrice ?? 0;
                const subtotal = item.lineTotal ?? (unitPrice * item.quantity);

                return (
                  <div key={itemId} className="checkout-summary__item">
                    <div className="checkout-summary__img-wrap">
                      <img
                        src={itemImg}
                        alt={itemName}
                        onError={handleImageError}
                      />
                      <span className="checkout-summary__qty">{item.quantity}</span>
                    </div>
                    <div className="checkout-summary__item-info">
                      <span className="checkout-summary__item-name">{itemName}</span>
                      <span className="checkout-summary__item-size">{formatPrice(unitPrice)}</span>
                    </div>
                    <span className="checkout-summary__item-price">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Promotion Code Input */}
            <div style={{ margin: 'var(--space-md) 0 var(--space-lg)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
              <label htmlFor="checkout-promo-code" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                🎁 Mã Khuyến Mãi (nếu có)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="checkout-promo-code"
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã (VD: TEABLISS2T1)..."
                  value={promotionCode}
                  onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
                  style={{ textTransform: 'uppercase', flex: 1 }}
                />
              </div>
            </div>

            <div className="checkout-summary__totals">
              <div className="checkout-summary__row">
                <span>Tạm tính</span>
                <span>{formatPrice(totalPrice)}</span>
              </div>
              <div className="checkout-summary__row">
                <span>Phí vận chuyển</span>
                <span className={shippingFee === 0 ? 'free-text' : ''}>
                  {shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}
                </span>
              </div>
              <div className="checkout-summary__grand">
                <span>Tổng Cộng</span>
                <strong>{formatPrice(grandTotal)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
