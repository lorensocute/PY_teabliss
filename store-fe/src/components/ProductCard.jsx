import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './ProductCard.css';

const TAG_LABELS = {
  BESTSELLER: { badge: 'badge-gold', text: '⭐ Bán Chạy' },
  NEW:        { badge: 'badge-new',  text: '✨ Mới' },
  PREMIUM:    { badge: 'badge-gold', text: '💎 Premium' },
};

import { getProductImage, handleImageError } from '../utils/imageHelper';
import { formatCategoryName, formatProductName } from '../utils/categoryHelper';

export default function ProductCard({ product, onAddToCart }) {
  const { items } = useCart();
  const inCart = items.some((i) => (i.productId ?? i.product?.id) === product.id);

  const formatPrice = (price) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);

  // Backend field: imageUrl — fallback to placeholder or local mapping
  const imgSrc = getProductImage(product);

  // Backend field: tag (BESTSELLER | NEW | PREMIUM | NONE | null)
  const tagKey = product.tag && product.tag !== 'NONE' ? product.tag : null;
  const tagInfo = tagKey ? TAG_LABELS[tagKey] : null;

  // Backend field: categoryName
  const categoryLabel = formatCategoryName(product.categoryName) || '';

  // Description — truncate safely
  const desc = product.description || '';
  const descShort = desc.length > 90 ? desc.slice(0, 90) + '...' : desc;

  // Out of stock
  const outOfStock =
    (product.stockQuantity != null && product.stockQuantity <= 0) ||
    product.status === 'OUT_OF_STOCK';

  return (
    <article className="product-card animate-fadeInUp" id={`product-card-${product.id}`}>
      {/* Badges */}
      <div className="product-card__badges">
        {tagInfo && <span className={`badge ${tagInfo.badge}`}>{tagInfo.text}</span>}
        {inCart && (
          <span className="badge" style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
            ✓ Trong Giỏ
          </span>
        )}
        {outOfStock && (
          <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
            Hết hàng
          </span>
        )}
      </div>

      {/* Image */}
      <Link to={`/products/${product.id}`} className="product-card__img-wrap">
        <img
          src={imgSrc}
          alt={formatProductName(product.name)}
          className="product-card__img"
          loading="lazy"
          onError={handleImageError}
        />
        <div className="product-card__img-overlay">
          <span className="product-card__view-btn">Xem Chi Tiết →</span>
        </div>
      </Link>

      {/* Body */}
      <div className="product-card__body">
        {categoryLabel && (
          <div className="product-card__category">{categoryLabel}</div>
        )}

        <Link to={`/products/${product.id}`} className="product-card__name">
          {formatProductName(product.name)}
        </Link>

        {descShort && (
          <p className="product-card__desc">{descShort}</p>
        )}

        <div className="product-card__footer">
          <div className="product-card__price">
            <span className="product-card__price-label">từ</span>
            <span className="product-card__price-value">{formatPrice(product.price)}</span>
          </div>
          <div className="product-card__actions">
            <Link
              to={`/products/${product.id}`}
              className="btn btn-secondary btn-sm"
              id={`view-detail-${product.id}`}
            >
              Chi Tiết
            </Link>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => !outOfStock && onAddToCart && onAddToCart(product)}
              id={`quick-add-${product.id}`}
              aria-label={`Thêm ${formatProductName(product.name)} vào giỏ hàng`}
              disabled={outOfStock}
            >
              {outOfStock ? 'Hết hàng' : '+ Thêm'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
