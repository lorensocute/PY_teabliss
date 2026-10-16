import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import ProductCard from '../components/ProductCard';
import { toast } from '../components/Toast';
import { useCart } from '../context/CartContext';
import { getProductImage, handleImageError } from '../utils/imageHelper';
import { formatCategoryName, formatCategoryDescription } from '../utils/categoryHelper';
import './HomePage.css';

/* ─── Visual config cho 4 nhóm category chính ─── */
const CATEGORY_META = {
  'tra-sua': {
    name: 'Trà Sữa',
    tag: 'Béo ngậy & Thơm nồng',
    desc: 'Trà sữa đậm đà kết hợp lớp bọt sữa mềm mịn và trân châu dẻo ngọt.',
    image: '/images/products/tra-sua-tran-chau.webp',
    gradient: 'linear-gradient(135deg, rgba(200, 149, 108, 0.4) 0%, rgba(139, 94, 60, 0.6) 100%)',
    accentColor: '#c8956c',
  },
  'tra-trai-cay': {
    name: 'Trà Trái Cây',
    tag: 'Thanh mát & Nhiệt đới',
    desc: 'Hòa quyện vị trà thanh khiết cùng hoa quả tươi mọng giàu vitamin.',
    image: '/images/products/tra-dao-cam-sa.webp',
    gradient: 'linear-gradient(135deg, rgba(232, 131, 74, 0.4) 0%, rgba(192, 57, 43, 0.6) 100%)',
    accentColor: '#e8834a',
  },
  'ca-phe': {
    name: 'Cà Phê',
    tag: 'Đậm đà & Tỉnh táo',
    desc: 'Hạt cà phê rang mộc chuẩn gu Việt, hương thơm quyến rũ nồng nàn.',
    image: '/images/products/ca-phe-sua.webp',
    gradient: 'linear-gradient(135deg, rgba(160, 100, 60, 0.4) 0%, rgba(80, 45, 25, 0.6) 100%)',
    accentColor: '#b8852e',
  },
  'matcha': {
    name: 'Matcha',
    tag: 'Thanh khiết chuẩn Nhật',
    desc: 'Matcha nguyên chất ngát vị trà xanh, béo dịu thơm ngon đặc trưng.',
    image: '/images/products/matcha-latte.webp',
    gradient: 'linear-gradient(135deg, rgba(46, 139, 87, 0.4) 0%, rgba(20, 90, 50, 0.6) 100%)',
    accentColor: '#2dd4bf',
  },
};

function getCategoryMeta(cat) {
  const norm = (cat.slug || cat.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  if (norm.includes('matcha')) return CATEGORY_META['matcha'];
  if (norm.includes('ca phe') || norm.includes('coffee')) return CATEGORY_META['ca-phe'];
  if (norm.includes('trai cay') || norm.includes('fruit')) return CATEGORY_META['tra-trai-cay'];
  return CATEGORY_META['tra-sua'];
}

/* ─── Inline SVG Icons cho độ nét tối đa và nhẹ nhàng ─── */
const Icons = {
  Leaf: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  FreshBrew: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  CustomChoice: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20v-6M6 20V10M18 20V4" />
      <circle cx="12" cy="11" r="2" />
      <circle cx="6" cy="7" r="2" />
      <circle cx="18" cy="15" r="2" />
    </svg>
  ),
  FastDelivery: () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <path d="M15 6h-5a2 2 0 0 0-2 2v7h11V8.5L16.5 6H15Z" />
      <path d="M3 9h5" />
      <path d="M2 13h6" />
    </svg>
  ),
  Cup: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  ),
  ArrowRight: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Star: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
};

/* ─── A. HERO SECTION ─── */
function HeroSection() {
  return (
    <section className="hero" id="hero-section">
      <div className="hero__bg">
        <div className="hero__orb hero__orb--1" />
        <div className="hero__orb hero__orb--2" />
        <div className="hero__orb hero__orb--3" />
        <div className="hero__particles">
          {[...Array(12)].map((_, i) => (
            <span key={i} className="hero__particle" style={{ '--i': i }} />
          ))}
        </div>
      </div>

      <div className="container hero__container">
        <div className="hero__content">
          <div className="hero__brand-badge animate-fadeInUp">
            <span className="hero__brand-dot" />
            <span className="hero__brand-tag">TEABLISS DRINK STORE</span>
            <span className="hero__brand-sub">• 100% Nguyên Liệu Tươi Mới</span>
          </div>

          <h1 className="hero__title animate-fadeInUp delay-1">
            Đậm Vị Trà Thơm,<br />
            <span className="text-gradient">Ngọt Ngào Từng Ngụm</span><br />
            Trà Sữa Hảo Hạng
          </h1>

          <p className="hero__subtitle animate-fadeInUp delay-2">
            Đắm chìm trong thế giới đồ uống thượng hạng của <strong>TeaBliss</strong>. Từ trà sữa trân châu béo thơm, 
            trà trái cây nhiệt đới tươi mát đến cà phê rang xay đậm đà và matcha thanh khiết chuẩn vị.
          </p>

          <div className="hero__actions animate-fadeInUp delay-3">
            <Link to="/products" className="btn btn-primary btn-lg" id="hero-explore-btn">
              Khám phá menu
              <Icons.ArrowRight />
            </Link>
            <Link to="/products" className="btn btn-ghost btn-lg" id="hero-order-btn">
              Đặt ngay
            </Link>
          </div>

          <div className="hero__stats animate-fadeInUp delay-4">
            <div className="hero__stat">
              <strong>20+</strong>
              <span>Món Đồ Uống</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <strong>4</strong>
              <span>Nhóm Hương Vị</span>
            </div>
            <div className="hero__stat-divider" />
            <div className="hero__stat">
              <strong>4.9★</strong>
              <span>Đánh Giá Cao</span>
            </div>
          </div>
        </div>

        <div className="hero__visual animate-fadeInUp delay-2">
          <div className="hero__img-wrap animate-float">
            <img
              src="/images/products/tra-sua-tran-chau.webp"
              alt="TeaBliss Signature Drink"
              className="hero__img"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=600&h=600&fit=crop&q=80';
              }}
            />
            <div className="hero__img-ring" />
            <div className="hero__img-glow" />
          </div>

          <div className="hero__badge hero__badge--rating">
            <div className="hero__badge-icon-wrap" style={{ color: '#d4a853' }}>
              <Icons.Star />
            </div>
            <div>
              <span>4.9 / 5.0</span>
              <small>Hơn 10k đánh giá yêu thích</small>
            </div>
          </div>

          <div className="hero__badge hero__badge--delivery">
            <div className="hero__badge-icon-wrap" style={{ color: '#2dd4bf' }}>
              <Icons.FastDelivery />
            </div>
            <div>
              <span>Giao Nhanh 30'</span>
              <small>Mát lạnh tận tay bạn</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Promo Marquee ─── */
function PromoMarquee() {
  const highlights = [
    '✨ Nguyên liệu trà thượng hạng từ cao nguyên Lâm Đồng',
    '🧋 Trân châu tươi nấu mới mỗi ngày theo công thức thủ công',
    '🍃 Tùy chỉnh mức đường & đá theo khẩu vị riêng của bạn',
    '🚀 Giao hàng siêu tốc trong 30 phút, đảm bảo trọn vị thơm ngon',
    '🎁 Giảm ngay 20% cho đơn hàng đầu tiên với TeaBliss',
  ];

  return (
    <div className="promo-marquee">
      <div className="promo-marquee__track">
        {[...highlights, ...highlights].map((text, idx) => (
          <span key={idx} className="promo-marquee__item">
            {text}
            <span className="promo-marquee__dot">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── B. CATEGORY SECTION (4 nhóm: Trà sữa, Trà trái cây, Cà phê, Matcha) ─── */
function CategorySection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCategories()
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="category-section section-pad" id="category-section">
      <div className="container">
        <div className="section-header text-center">
          <div className="section-tag" style={{ justifyContent: 'center' }}>
            <Icons.Cup />
            <span>Thực Đơn Đa Dạng</span>
          </div>
          <h2 className="heading-xl">Khám Phá 4 Nhóm Đồ Uống</h2>
          <p className="section-desc">
            Từ vị béo ngậy ngọt ngào đến thanh mát sảng khoái, chọn ngay nhóm hương vị yêu thích của bạn.
          </p>
        </div>

        {loading ? (
          <div className="section-loading">
            <div className="spinner" />
          </div>
        ) : (
          <div className="category-grid">
            {categories.map((cat, idx) => {
              const meta = getCategoryMeta(cat);
              const cardImage = cat.imageUrl || meta.image;
              const displayName = formatCategoryName(cat.name);
              const displayDesc = formatCategoryDescription(cat.description, cat.name) || meta.desc;

              return (
                <Link
                  to={`/products?categoryId=${cat.id}`}
                  key={cat.id}
                  className={`category-item-card animate-fadeInUp delay-${Math.min(idx + 1, 4)}`}
                  id={`cat-card-${cat.id}`}
                  style={{ '--cat-accent': meta.accentColor }}
                >
                  <div className="category-item-card__bg" style={{ background: meta.gradient }} />
                  <div className="category-item-card__img-wrap">
                    <img
                      src={cardImage}
                      alt={displayName}
                      className="category-item-card__img"
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = meta.image;
                      }}
                    />
                  </div>
                  <div className="category-item-card__overlay" />
                  <div className="category-item-card__content">
                    <div className="category-item-card__tag">{meta.tag}</div>
                    <h3 className="category-item-card__title">{displayName}</h3>
                    <p className="category-item-card__desc">
                      {displayDesc}
                    </p>
                    <div className="category-item-card__cta">
                      <span>Xem Thực Đơn</span>
                      <Icons.ArrowRight />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── C. FEATURED PRODUCTS (8 sản phẩm ACTIVE từ backend) ─── */
function FeaturedProductsSection() {
  const { addItem } = useCart();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProducts()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        // Lấy 8 sản phẩm ACTIVE từ backend
        const activeList = list.filter((p) => p.active !== false);
        setProducts(activeList.slice(0, 8));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleQuickAdd = async (product) => {
    const defaultOptions = {
      size: 'M',
      sweetness: 100,
      ice: 'NORMAL_ICE',
      toppings: [],
    };
    const success = await addItem(product, 1, defaultOptions);
    if (success) {
      toast(`🧋 Đã thêm "${product.name}" vào giỏ hàng!`, 'success');
    }
  };

  return (
    <section className="featured-section section-pad" id="featured-section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="section-tag">
              <Icons.Star />
              <span>Gợi Ý Dành Riêng Cho Bạn</span>
            </div>
            <h2 className="heading-xl">Món Nổi Bật Bán Chạy</h2>
            <p className="section-desc">
              Những món best-seller được hàng nghìn khách hàng yêu thích và lựa chọn mỗi ngày.
            </p>
          </div>
          <Link to="/products" className="btn btn-ghost" id="view-all-products-btn">
            Xem Tất Cả Menu <Icons.ArrowRight />
          </Link>
        </div>

        {loading ? (
          <div className="section-loading">
            <div className="spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🧋</div>
            <p className="empty-state__desc">Hiện tại chưa có sản phẩm nào sẵn sàng.</p>
          </div>
        ) : (
          <div className="featured-products-grid">
            {products.map((p, i) => (
              <div key={p.id} className={`animate-fadeInUp delay-${Math.min((i % 4) + 1, 4)}`}>
                <ProductCard product={p} onAddToCart={handleQuickAdd} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── D. WHY TEABLISS ─── */
function WhyTeaBlissSection() {
  const reasons = [
    {
      icon: <Icons.Leaf />,
      title: 'Nguyên Liệu Chất Lượng',
      desc: '100% búp trà tươi tuyển chọn từ các vùng nguyên liệu trứ danh, sữa tươi thanh trùng và trái cây tươi mỗi ngày.',
    },
    {
      icon: <Icons.FreshBrew />,
      title: 'Pha Chế Tươi Mới',
      desc: 'Mỗi ly đồ uống chỉ được ủ trà và pha chế trực tiếp khi có đơn hàng, giữ trọn hương vị tươi nguyên chuẩn vị.',
    },
    {
      icon: <Icons.CustomChoice />,
      title: 'Nhiều Lựa Chọn',
      desc: 'Tự do tùy chỉnh mức ngọt, lượng đá, chọn kích cỡ ly và kết hợp cùng kho topping trân châu, thạch, kem cheese phong phú.',
    },
    {
      icon: <Icons.FastDelivery />,
      title: 'Đặt Hàng Tiện Lợi',
      desc: 'Giao diện đặt món mượt mà, hỗ trợ thanh toán linh hoạt và cam kết giao hàng nhanh trong 30 phút giữ nhiệt mát lạnh.',
    },
  ];

  return (
    <section className="why-teabliss-section section-pad" id="why-teabliss-section">
      <div className="container">
        <div className="section-header text-center">
          <div className="section-tag" style={{ justifyContent: 'center' }}>
            <Icons.Check />
            <span>Giá Trị Khác Biệt</span>
          </div>
          <h2 className="heading-xl">Tại Sao Bạn Sẽ Yêu TeaBliss?</h2>
          <p className="section-desc">
            Chúng tôi chăm chút tỉ mỉ từ khâu chọn lá trà đến giọt sữa cuối cùng để mang lại trải nghiệm hoàn hảo.
          </p>
        </div>

        <div className="why-grid">
          {reasons.map((r, i) => (
            <div key={i} className={`why-card glass-card animate-fadeInUp delay-${i + 1}`}>
              <div className="why-card__icon-box">
                {r.icon}
              </div>
              <h3 className="why-card__title">{r.title}</h3>
              <p className="why-card__desc">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── E. CTA CUỐI TRANG ─── */
function BottomCTASection() {
  return (
    <section className="bottom-cta-section" id="bottom-cta-section">
      <div className="bottom-cta__bg" />
      <div className="container">
        <div className="bottom-cta__card">
          <div className="bottom-cta__content">
            <span className="bottom-cta__badge">🌿 Trải Nghiệm Hương Vị Đỉnh Cao</span>
            <h2 className="bottom-cta__title">Chọn Hương Vị Yêu Thích Của Bạn</h2>
            <p className="bottom-cta__desc">
              Một ly trà thơm ngon sẽ làm bừng sáng cả ngày làm việc và học tập. Khám phá ngay thực đơn hơn 20 món đồ uống hấp dẫn đang chờ bạn tại TeaBliss!
            </p>
            <div className="bottom-cta__actions">
              <Link to="/products" className="btn btn-primary btn-lg" id="bottom-cta-menu-btn">
                Khám phá menu ngay <Icons.ArrowRight />
              </Link>
              <Link to="/products" className="btn btn-ghost btn-lg" id="bottom-cta-order-btn">
                Đặt ngay
              </Link>
            </div>
          </div>
          <div className="bottom-cta__visual">
            <div className="bottom-cta__img-grid">
              <img
                src="/images/products/tra-sua-duong-den.webp"
                alt="Trà sữa đường đen"
                className="bottom-cta__img bottom-cta__img--1"
                onError={handleImageError}
              />
              <img
                src="/images/products/matcha-latte.webp"
                alt="Matcha Latte"
                className="bottom-cta__img bottom-cta__img--2"
                onError={handleImageError}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── MAIN HOME PAGE ─── */
export default function HomePage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'TeaBliss - Trà Sữa & Đồ Uống Tươi Mới Thượng Hạng';
  }, []);

  return (
    <div className="home-page-wrapper">
      {/* A. HERO SECTION */}
      <HeroSection />

      {/* PROMO MARQUEE */}
      <PromoMarquee />

      {/* B. CATEGORY SECTION */}
      <CategorySection />

      {/* C. FEATURED PRODUCTS (8 sản phẩm active từ backend) */}
      <FeaturedProductsSection />

      {/* D. WHY TEABLISS */}
      <WhyTeaBlissSection />

      {/* E. CTA CUỐI TRANG */}
      <BottomCTASection />
    </div>
  );
}
