import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useCart } from '../context/CartContext';
import { toast } from '../components/Toast';
import ProductCard from '../components/ProductCard';
import { getProductImage, handleImageError } from '../utils/imageHelper';
import { formatCategoryName, formatProductName } from '../utils/categoryHelper';
import './ProductDetailPage.css';

/* ─── 1. BACKEND PRICING CONSTANTS (Đồng bộ 100% với DrinkSize, DrinkIce, ToppingPriceTable) ─── */
const SIZES = [
  { id: 'M',  label: 'Size M',  volume: '350ml', priceAdd: 0 },
  { id: 'L',  label: 'Size L',  volume: '500ml', priceAdd: 5000 },
  { id: 'XL', label: 'Size XL', volume: '700ml', priceAdd: 10000 },
];

const SWEETNESS_OPTIONS = [
  { value: 0,   label: '0%',   desc: 'Không ngọt' },
  { value: 30,  label: '30%',  desc: 'Ít ngọt' },
  { value: 50,  label: '50%',  desc: 'Vừa' },
  { value: 70,  label: '70%',  desc: 'Ngọt vừa' },
  { value: 100, label: '100%', desc: 'Tiêu chuẩn' },
];

const ICE_OPTIONS = [
  { id: 'HOT',        label: 'Nóng',     desc: 'Ấm áp' },
  { id: 'LESS_ICE',   label: 'Ít đá',    desc: '30% đá' },
  { id: 'NORMAL_ICE', label: 'Đá vừa',   desc: '70% đá' },
  { id: 'FULL_ICE',   label: 'Nhiều đá', desc: '100% đá' },
];

// Đồng bộ 100% với ToppingPriceTable.java
const TOPPINGS = [
  { id: 'tapioca',       name: 'Trân châu đen',   price: 5000 },
  { id: 'white-tapioca', name: 'Trân châu trắng', price: 5000 },
  { id: 'pudding',       name: 'Pudding trứng',   price: 8000 },
  { id: 'jelly',         name: 'Thạch dừa',       price: 5000 },
  { id: 'cheese-foam',   name: 'Foam phô mai',    price: 10000 },
  { id: 'aloe',          name: 'Nha đam',         price: 7000 },
  { id: 'red-bean',      name: 'Đậu đỏ',          price: 6000 },
  { id: 'taro-ball',     name: 'Khoai môn viên',  price: 8000 },
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);

  // Form customisation state
  // Mặc định: size M, sweetness 100, ice NORMAL_ICE, toppings []
  const [selectedSize, setSelectedSize] = useState(SIZES[0]); // Size M
  const [selectedSweetness, setSelectedSweetness] = useState(100); // 100%
  const [selectedIce, setSelectedIce] = useState('NORMAL_ICE'); // Đá vừa
  const [selectedToppings, setSelectedToppings] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  /* ─── Fetch Product & Related Products ─── */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setQuantity(1);
    setSelectedSize(SIZES[0]);
    setSelectedSweetness(100);
    setSelectedIce('NORMAL_ICE');
    setSelectedToppings([]);

    api.getProductById(id)
      .then((data) => {
        if (!data) {
          setError('Không tìm thấy đồ uống này');
          setProduct(null);
          return;
        }
        setProduct(data);
        document.title = `${formatProductName(data.name)} | TeaBliss`;

        // Fetch related products (cùng category, loại trừ sản phẩm hiện tại, không INACTIVE)
        if (data.categoryId) {
          api.getProducts({ categoryId: data.categoryId })
            .then((list) => {
              if (Array.isArray(list)) {
                const related = list
                  .filter((p) => String(p.id) !== String(data.id) && p.status !== 'INACTIVE')
                  .slice(0, 4);
                setRelatedProducts(related);
              }
            })
            .catch(() => setRelatedProducts([]));
        }
      })
      .catch((err) => {
        setError(err.message || 'Lỗi khi tải thông tin sản phẩm');
        setProduct(null);
      })
      .finally(() => {
        setLoading(false);
      });

    window.scrollTo(0, 0);
  }, [id]);

  /* ─── Formatting helpers ─── */
  const formatPrice = (price) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

  /* ─── Stock & Status ─── */
  const outOfStock = useMemo(() => {
    if (!product) return false;
    return (
      (product.stockQuantity != null && product.stockQuantity <= 0) ||
      product.status === 'OUT_OF_STOCK'
    );
  }, [product]);

  const maxStock = product?.stockQuantity != null ? product.stockQuantity : 99;

  /* ─── Live Price Calculation (Khớp 100% CartServiceImpl) ─── */
  const basePrice = product?.price || 0;
  const sizeSurcharge = selectedSize?.priceAdd || 0;
  const toppingTotal = useMemo(() => {
    return selectedToppings.reduce((sum, t) => sum + (t.price || 0), 0);
  }, [selectedToppings]);

  const unitPrice = basePrice + sizeSurcharge + toppingTotal;
  const totalPrice = unitPrice * quantity;

  /* ─── Topping toggle ─── */
  const toggleTopping = (topping) => {
    setSelectedToppings((prev) =>
      prev.find((t) => t.id === topping.id)
        ? prev.filter((t) => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  /* ─── Quantity Controls ─── */
  const handleIncreaseQty = () => {
    if (outOfStock) return;
    if (product?.stockQuantity != null && quantity >= product.stockQuantity) {
      toast(`Chỉ còn ${product.stockQuantity} sản phẩm trong kho!`, 'warning');
      return;
    }
    setQuantity((q) => q + 1);
  };

  const handleDecreaseQty = () => {
    if (outOfStock) return;
    setQuantity((q) => Math.max(1, q - 1));
  };

  /* ─── Add to Cart ─── */
  const handleAddToCart = async () => {
    if (outOfStock) {
      toast('Sản phẩm hiện đang hết hàng!', 'error');
      return false;
    }

    // Kiểm tra sweetness hợp lệ: 0 là hợp lệ (Không ngọt), không dùng !selectedSweetness
    if (selectedSweetness === null || selectedSweetness === undefined) {
      toast('Vui lòng chọn mức độ ngọt!', 'warning');
      return false;
    }

    const options = {
      size: selectedSize.id,               // 'M' | 'L' | 'XL'
      sweetness: Number(selectedSweetness),// 0 | 30 | 50 | 70 | 100
      ice: selectedIce,                    // 'HOT' | 'LESS_ICE' | 'NORMAL_ICE' | 'FULL_ICE'
      toppings: selectedToppings.map((t) => ({
        id: t.id,
        name: t.name,
        price: t.price,
      })),
    };

    const success = await addItem(product, quantity, options);
    if (success) {
      toast(`🧋 Đã thêm ${quantity} ly "${product.name}" vào giỏ hàng!`, 'success');
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
      return true;
    }
    return false;
  };

  /* ─── Buy Now (Thêm vào giỏ và chuyển sang trang Cart) ─── */
  const handleBuyNow = async () => {
    if (outOfStock) {
      toast('Sản phẩm hiện đang hết hàng!', 'error');
      return;
    }
    const success = await handleAddToCart();
    if (success) {
      navigate('/cart');
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper product-detail-page">
        <div className="container detail-loading-wrap">
          <div className="spinner" />
          <p>Đang tải thông tin đồ uống...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-wrapper product-detail-page">
        <div className="container">
          <div className="empty-state" style={{ marginTop: '60px' }}>
            <div className="empty-state__icon">😔</div>
            <h2 className="empty-state__title">Không Tìm Thấy Đồ Uống</h2>
            <p className="empty-state__desc">Món đồ uống này không tồn tại hoặc đã ngừng phục vụ.</p>
            <Link to="/products" className="btn btn-primary" id="back-to-products-btn">
              Xem Toàn Bộ Thực Đơn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const categoryName = formatCategoryName(product.categoryName) || 'Đồ Uống';
  const mainImage = getProductImage(product);

  return (
    <div className="page-wrapper product-detail-page">
      {/* Breadcrumb */}
      <div className="detail-breadcrumb-wrap">
        <div className="container">
          <nav className="detail-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Trang Chủ</Link>
            <span className="sep">/</span>
            <Link to="/products">Thực Đơn</Link>
            {product.categoryId && (
              <>
                <span className="sep">/</span>
                <Link to={`/products?categoryId=${product.categoryId}`}>{categoryName}</Link>
              </>
            )}
            <span className="sep">/</span>
            <span className="current">{formatProductName(product.name)}</span>
          </nav>
        </div>
      </div>

      <div className="container">
        {/* 2. LAYOUT PRODUCT DETAIL (2 CỘT DESKTOP, 1 CỘT MOBILE) */}
        <div className="product-detail-layout">
          {/* CỘT TRÁI (LEFT): ẢNH SẢN PHẨM LỚN & STATUS BADGES */}
          <div className="product-detail__left">
            <div className="product-detail__img-card">
              <div className="product-detail__img-wrap">
                <img
                  src={mainImage}
                  alt={formatProductName(product.name)}
                  className="product-detail__main-img"
                  onError={handleImageError}
                />
                <div className="product-detail__img-glow" />
              </div>

              {/* Status Badges */}
              <div className="product-detail__badges">
                <span className="detail-badge detail-badge--cat">
                  🍵 {categoryName}
                </span>
                {outOfStock ? (
                  <span className="detail-badge detail-badge--out">
                    Hết hàng
                  </span>
                ) : (
                  <span className="detail-badge detail-badge--stock">
                    ✓ Còn hàng
                  </span>
                )}
              </div>
            </div>

            {/* 10. THÔNG TIN SẢN PHẨM & COMMITS */}
            <div className="product-detail__meta-box">
              <h3 className="meta-box__title">🌿 Cam Kết Từ TeaBliss</h3>
              <div className="meta-box__list">
                <div className="meta-box__item">
                  <span className="meta-box__icon">🍵</span>
                  <div>
                    <strong>Pha chế tươi mới</strong>
                    <p>Ủ trà và pha chế trực tiếp khi nhận đơn hàng</p>
                  </div>
                </div>
                <div className="meta-box__item">
                  <span className="meta-box__icon">🍃</span>
                  <div>
                    <strong>Tự do tùy chỉnh</strong>
                    <p>Tùy ý điều chỉnh độ ngọt, lượng đá theo khẩu vị</p>
                  </div>
                </div>
                <div className="meta-box__item">
                  <span className="meta-box__icon">🚀</span>
                  <div>
                    <strong>Giao nhanh 30 phút</strong>
                    <p>Đóng gói cẩn thận, giữ lạnh trọn vẹn hương vị</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI (RIGHT): THÔNG TIN & CUSTOMIZATION */}
          <div className="product-detail__right">
            {/* Header info */}
            <div className="detail-header-info">
              <span className="detail-cat-tag">TEABLISS SIGNATURE • {categoryName}</span>
              <h1 className="detail-title">{formatProductName(product.name)}</h1>
              <p className="detail-desc">{product.description}</p>

              <div className="detail-base-price-row">
                <span className="detail-base-price-label">Giá gốc:</span>
                <span className="detail-base-price-value">{formatPrice(basePrice)}</span>
                {product.stockQuantity != null && (
                  <span className="detail-stock-text">
                    ({product.stockQuantity > 0 ? `Còn ${product.stockQuantity} phần` : 'Tạm hết hàng'})
                  </span>
                )}
              </div>
            </div>

            <div className="detail-separator" />

            {/* 3. SIZE SELECTION */}
            <div className="custom-section">
              <div className="custom-section__header">
                <span className="custom-section__title">1. Chọn Kích Cỡ (Size)</span>
                <span className="custom-section__hint">Bắt buộc</span>
              </div>
              <div className="size-options-grid">
                {SIZES.map((size) => {
                  const isSelected = selectedSize.id === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      className={`size-card ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedSize(size)}
                      id={`size-btn-${size.id}`}
                    >
                      <div className="size-card__header">
                        <span className="size-card__id">{size.id}</span>
                        <span className="size-card__volume">{size.volume}</span>
                      </div>
                      <div className="size-card__surcharge">
                        {size.priceAdd === 0 ? 'Giá gốc' : `+${formatPrice(size.priceAdd)}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. SWEETNESS SELECTION */}
            <div className="custom-section">
              <div className="custom-section__header">
                <span className="custom-section__title">2. Chọn Độ Ngọt</span>
                <span className="custom-section__hint">
                  {selectedSweetness === 0 ? 'Không ngọt (0%)' : `Mức ${selectedSweetness}%`}
                </span>
              </div>
              <div className="pill-options-grid">
                {SWEETNESS_OPTIONS.map((opt) => {
                  const isSelected = selectedSweetness === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`pill-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedSweetness(opt.value)}
                      id={`sweetness-btn-${opt.value}`}
                    >
                      <span className="pill-btn__val">{opt.label}</span>
                      <span className="pill-btn__desc">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. ICE SELECTION */}
            <div className="custom-section">
              <div className="custom-section__header">
                <span className="custom-section__title">3. Chọn Lượng Đá</span>
                <span className="custom-section__hint">
                  {ICE_OPTIONS.find((o) => o.id === selectedIce)?.label}
                </span>
              </div>
              <div className="pill-options-grid">
                {ICE_OPTIONS.map((opt) => {
                  const isSelected = selectedIce === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`pill-btn ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedIce(opt.id)}
                      id={`ice-btn-${opt.id}`}
                    >
                      <span className="pill-btn__val">{opt.label}</span>
                      <span className="pill-btn__desc">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 6. TOPPING SELECTION */}
            <div className="custom-section">
              <div className="custom-section__header">
                <span className="custom-section__title">4. Thêm Topping Hảo Hạng</span>
                <span className="custom-section__hint">Chọn nhiều (tùy chọn)</span>
              </div>
              <div className="topping-options-grid">
                {TOPPINGS.map((t) => {
                  const isSelected = selectedToppings.some((st) => st.id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`topping-card ${isSelected ? 'active' : ''}`}
                      onClick={() => toggleTopping(t)}
                      id={`topping-btn-${t.id}`}
                    >
                      <span className="topping-card__check">{isSelected ? '✓' : '+'}</span>
                      <span className="topping-card__name">{t.name}</span>
                      <span className="topping-card__price">+{formatPrice(t.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="detail-separator" />

            {/* 7. LIVE PRICE BREAKDOWN */}
            <div className="price-breakdown-box">
              <div className="price-breakdown__row">
                <span>Giá món gốc:</span>
                <span>{formatPrice(basePrice)}</span>
              </div>
              <div className="price-breakdown__row">
                <span>
                  Size {selectedSize.id} ({selectedSize.volume}):
                </span>
                <span>{sizeSurcharge === 0 ? '+0đ' : `+${formatPrice(sizeSurcharge)}`}</span>
              </div>
              {selectedToppings.length > 0 && (
                <div className="price-breakdown__row">
                  <span>Topping ({selectedToppings.length} loại):</span>
                  <span>+{formatPrice(toppingTotal)}</span>
                </div>
              )}
              <div className="price-breakdown__row unit-row">
                <strong>Đơn giá 1 ly:</strong>
                <strong className="unit-price-val">{formatPrice(unitPrice)}</strong>
              </div>
              {quantity > 1 && (
                <div className="price-breakdown__row total-calc-row">
                  <span>Tổng ({quantity} ly):</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
              )}
            </div>

            {/* 8. QUANTITY & 9. ADD TO CART ACTION */}
            <div className="order-action-bar">
              <div className="qty-picker">
                <button
                  type="button"
                  className="qty-picker__btn"
                  onClick={handleDecreaseQty}
                  disabled={quantity <= 1 || outOfStock}
                  aria-label="Giảm số lượng"
                >
                  −
                </button>
                <span className="qty-picker__val">{quantity}</span>
                <button
                  type="button"
                  className="qty-picker__btn"
                  onClick={handleIncreaseQty}
                  disabled={outOfStock || quantity >= maxStock}
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>

              <div className="order-action-bar__buttons">
                <button
                  type="button"
                  className={`btn btn-primary btn-lg add-cart-btn ${added ? 'added' : ''}`}
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                  id="add-to-cart-main-btn"
                >
                  {outOfStock
                    ? 'Tạm Hết Hàng'
                    : added
                    ? '✓ Đã Thêm Vào Giỏ'
                    : `🛒 Thêm vào giỏ • ${formatPrice(totalPrice)}`}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-lg buy-now-btn"
                  onClick={handleBuyNow}
                  disabled={outOfStock}
                  id="buy-now-main-btn"
                >
                  Đặt Ngay
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 11. RELATED PRODUCTS SECTION */}
        {relatedProducts.length > 0 && (
          <section className="related-products-section" id="related-products-section">
            <div className="section-header">
              <div>
                <div className="section-tag">🍵 Cùng Danh Mục</div>
                <h2 className="heading-xl">Có Thể Bạn Cũng Thích</h2>
              </div>
              <Link to={`/products?categoryId=${product.categoryId}`} className="btn btn-ghost">
                Xem Thêm →
              </Link>
            </div>
            <div className="related-products-grid">
              {relatedProducts.map((p) => (
                <div key={p.id} className="animate-fadeInUp">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
