import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import ProductCard from '../components/ProductCard';
import { toast } from '../components/Toast';
import { useCart } from '../context/CartContext';
import { formatCategoryName, formatCategoryDescription } from '../utils/categoryHelper';
import './ProductsPage.css';

/* ─── Helper xử lý tiếng Việt không dấu cho Search ─── */
function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}



const SORT_OPTIONS = [
  { value: 'default',    label: 'Mặc định' },
  { value: 'price-asc',  label: 'Giá thấp → cao' },
  { value: 'price-desc', label: 'Giá cao → thấp' },
  { value: 'name-asc',   label: 'Tên A → Z' },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItem } = useCart();

  // URL params
  const categoryIdParam = searchParams.get('categoryId') || '';
  const categorySlugParam = searchParams.get('category') || '';
  const tagParam = searchParams.get('tag') || '';
  const initialSearchParam = searchParams.get('search') || '';

  // Local state
  const [searchQuery, setSearchQuery] = useState(initialSearchParam);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryIdParam);
  const [sort, setSort] = useState('default');

  // Data state
  const [rawProducts, setRawProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ─── Đồng bộ khi URL searchParams thay đổi (ví dụ điều hướng từ Navbar / HomePage) ─── */
  useEffect(() => {
    setSelectedCategoryId(categoryIdParam);
  }, [categoryIdParam]);

  useEffect(() => {
    if (initialSearchParam !== searchQuery) {
      setSearchQuery(initialSearchParam);
    }
  }, [initialSearchParam]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Fetch Categories & Products từ backend ─── */
  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      api.getCategories().catch(() => []),
      api.getProducts().catch((err) => {
        throw new Error(err.message || 'Không thể tải danh sách sản phẩm');
      }),
    ])
      .then(([cats, prods]) => {
        setCategories(Array.isArray(cats) ? cats : []);
        setRawProducts(Array.isArray(prods) ? prods : []);
      })
      .catch((err) => {
        setError(err.message || 'Đã xảy ra lỗi khi kết nối với máy chủ');
        setRawProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  /* ─── Set Page Title & Scroll top ─── */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  /* ─── Resolve selected category (hỗ trợ cả slug cũ) ─── */
  const activeCategory = useMemo(() => {
    if (selectedCategoryId) {
      return categories.find((c) => String(c.id) === String(selectedCategoryId)) || null;
    }
    if (categorySlugParam && categories.length > 0) {
      return (
        categories.find(
          (c) =>
            c.slug === categorySlugParam ||
            removeVietnameseTones(c.name).replace(/\s+/g, '-') === categorySlugParam
        ) || null
      );
    }
    return null;
  }, [selectedCategoryId, categorySlugParam, categories]);

  const categoryDisplayName = activeCategory ? formatCategoryName(activeCategory.name) : '';
  const categoryDisplayDesc = activeCategory ? formatCategoryDescription(activeCategory.description, activeCategory.name) : '';

  /* ─── Cập nhật title trình duyệt theo ngữ cảnh ─── */
  useEffect(() => {
    if (categoryDisplayName) {
      document.title = `${categoryDisplayName} | Thực Đơn TeaBliss`;
    } else if (tagParam === 'bestseller') {
      document.title = `Món Bán Chạy | Thực Đơn TeaBliss`;
    } else if (tagParam === 'new') {
      document.title = `Món Mới Ra Mắt | Thực Đơn TeaBliss`;
    } else {
      document.title = `Thực Đơn Đồ Uống | TeaBliss`;
    }
  }, [categoryDisplayName, tagParam]);

  /* ─── Filter & Sort Products ─── */
  // 1. Chỉ lấy sản phẩm có thể bán (bỏ INACTIVE)
  const publicProducts = useMemo(() => {
    return rawProducts.filter((p) => p.status !== 'INACTIVE');
  }, [rawProducts]);

  // 2. Filter theo Category, Search Query và Tag
  const filteredProducts = useMemo(() => {
    let list = [...publicProducts];

    // Lọc theo Category
    const currentCatId = activeCategory ? activeCategory.id : selectedCategoryId;
    if (currentCatId) {
      list = list.filter((p) => String(p.categoryId) === String(currentCatId));
    }

    // Lọc theo Tag từ Navbar (Bán Chạy / Mới Ra Mắt)
    if (tagParam === 'bestseller') {
      list = list.filter((p) => p.tag === 'BESTSELLER' || p.isBestseller || [1, 5, 9, 14, 15, 19].includes(p.id));
    } else if (tagParam === 'new') {
      list = list.filter((p) => p.tag === 'NEW' || p.isNew || [6, 10, 16, 20, 22].includes(p.id));
    }

    // Lọc theo Search Query (tiếng Việt có dấu / không dấu)
    const cleanQuery = removeVietnameseTones(searchQuery);
    if (cleanQuery) {
      list = list.filter((p) => {
        const nameNorm = removeVietnameseTones(p.name);
        const descNorm = removeVietnameseTones(p.description);
        return nameNorm.includes(cleanQuery) || descNorm.includes(cleanQuery);
      });
    }

    // Sort
    switch (sort) {
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price);
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      default:
        return list; // Thứ tự mặc định backend
    }
  }, [publicProducts, activeCategory, selectedCategoryId, tagParam, searchQuery, sort]);

  /* ─── Xử lý chọn Category (bỏ chọn khi xóa chip) ─── */
  const handleSelectCategory = (catId) => {
    setSelectedCategoryId(catId ? String(catId) : '');
    const nextParams = new URLSearchParams(searchParams);
    if (catId) {
      nextParams.set('categoryId', catId);
    } else {
      nextParams.delete('categoryId');
    }
    nextParams.delete('category'); // Xóa slug cũ nếu có
    setSearchParams(nextParams);
  };

  /* ─── Xử lý Search input ─── */
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    const nextParams = new URLSearchParams(searchParams);
    if (val.trim()) {
      nextParams.set('search', val);
    } else {
      nextParams.delete('search');
    }
    setSearchParams(nextParams);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    setSearchParams(nextParams);
  };

  const handleClearTag = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tag');
    setSearchParams(nextParams);
  };

  /* ─── Reset tất cả bộ lọc ─── */
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategoryId('');
    setSort('default');
    setSearchParams({});
  };

  /* ─── Quick Add to Cart ─── */
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

  // Xác định tiêu đề hiển thị
  const pageTitle = categoryDisplayName
    ? categoryDisplayName
    : tagParam === 'bestseller'
    ? 'Món Bán Chạy'
    : tagParam === 'new'
    ? 'Món Mới Ra Mắt'
    : 'Thực Đơn';

  return (
    <div className="page-wrapper products-page">
      {/* 1. HEADER / MENU HERO */}
      <section className="menu-hero" id="menu-hero">
        <div className="menu-hero__bg" />
        <div className="container menu-hero__inner">
          <nav className="menu-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Trang Chủ</Link>
            <span className="menu-breadcrumb__sep">/</span>
            <span className="menu-breadcrumb__current">
              {pageTitle}
            </span>
          </nav>

          <div className="menu-hero__badge">
            <span className="menu-hero__badge-dot" />
            <span>TEABLISS MENU</span>
          </div>

          <h1 className="menu-hero__title">
            {pageTitle}
          </h1>

          <p className="menu-hero__desc">
            {categoryDisplayDesc
              ? categoryDisplayDesc
              : tagParam === 'bestseller'
              ? 'Những món đồ uống được yêu thích và đặt hàng nhiều nhất tại TeaBliss.'
              : tagParam === 'new'
              ? 'Các hương vị sáng tạo mới ra mắt, mang lại trải nghiệm tươi mới và sảng khoái.'
              : 'Thực đơn đồ uống tươi mới từ lá trà nguyên bản, sữa tươi thanh trùng, cà phê rang mộc và trái cây nhiệt đới.'}
          </p>

          <div className="menu-hero__meta">
            <span className="menu-hero__count-badge">
              🌿 {publicProducts.length} Món Đồ Uống Khả Dụng
            </span>
            <span className="menu-hero__divider">•</span>
            <span>4 Nhóm Hương Vị</span>
            <span className="menu-hero__divider">•</span>
            <span>100% Pha Chế Tươi Mới</span>
          </div>
        </div>
      </section>

      {/* MENU CONTROLS & FILTER BAR */}
      <section className="menu-controls-section">
        <div className="container">
          <div className="menu-controls-card">
            {/* Hàng 1: Search Box & Sort Dropdown */}
            <div className="menu-controls__top">
              {/* SEARCH BOX */}
              <div className="menu-search">
                <span className="menu-search__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="menu-search__input"
                  placeholder="Tìm trà sữa, matcha, cà phê..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  id="menu-search-input"
                  aria-label="Tìm kiếm đồ uống"
                />
                {searchQuery && (
                  <button
                    className="menu-search__clear"
                    onClick={handleClearSearch}
                    aria-label="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* SORT DROPDOWN */}
              <div className="menu-sort-wrap">
                <span className="menu-sort-label">Sắp xếp:</span>
                <select
                  className="menu-sort-select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  id="menu-sort-select"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* RESULT INFORMATION & ACTIVE FILTER CHIPS */}
            <div className="menu-result-info">
              <div className="menu-result-info__count">
                Hiển thị <strong>{filteredProducts.length}</strong> / {publicProducts.length} sản phẩm
              </div>

              {(searchQuery || selectedCategoryId || categorySlugParam || tagParam) && (
                <div className="menu-active-chips">
                  {categoryDisplayName && (
                    <span className="menu-chip" id="active-category-chip">
                      Danh mục: <strong>{categoryDisplayName}</strong>
                      <button onClick={() => handleSelectCategory('')} title="Bỏ chọn danh mục" aria-label="Bỏ chọn danh mục">✕</button>
                    </span>
                  )}
                  {tagParam && (
                    <span className="menu-chip" id="active-tag-chip">
                      Thẻ: <strong>{tagParam === 'bestseller' ? 'Bán Chạy' : tagParam === 'new' ? 'Mới Ra Mắt' : tagParam}</strong>
                      <button onClick={handleClearTag} title="Bỏ lọc thẻ" aria-label="Bỏ lọc thẻ">✕</button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="menu-chip" id="active-search-chip">
                      Tìm kiếm: <strong>"{searchQuery}"</strong>
                      <button onClick={handleClearSearch} title="Xóa từ khóa" aria-label="Xóa từ khóa tìm kiếm">✕</button>
                    </span>
                  )}
                  <button
                    className="menu-chip-reset"
                    onClick={handleResetFilters}
                    id="reset-all-filters-btn"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 5. PRODUCT GRID & STATES */}
      <section className="menu-grid-section">
        <div className="container">
          {loading ? (
            <div className="menu-loading">
              <div className="spinner" />
              <p>Đang tải danh sách đồ uống TeaBliss...</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state__icon">⚠️</div>
              <h2 className="empty-state__title">Không thể tải thực đơn</h2>
              <p className="empty-state__desc">{error}</p>
              <button
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Tải lại trang
              </button>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="menu-product-grid" id="menu-product-grid">
              {filteredProducts.map((p, idx) => (
                <div
                  key={p.id}
                  className="animate-fadeInUp"
                  style={{ animationDelay: `${Math.min(idx % 8, 7) * 0.05}s` }}
                >
                  <ProductCard product={p} onAddToCart={handleQuickAdd} />
                </div>
              ))}
            </div>
          ) : (
            /* 6. EMPTY STATE KHI KHÔNG TÌM THẤY SẢN PHẨM */
            <div className="empty-state menu-empty-state">
              <div className="empty-state__icon">🔍</div>
              <h2 className="empty-state__title">Không tìm thấy đồ uống phù hợp</h2>
              <p className="empty-state__desc">
                Rất tiếc, không có món đồ uống nào khớp với yêu cầu tìm kiếm "{searchQuery}" 
                {categoryDisplayName ? ` trong nhóm ${categoryDisplayName}` : ''}.
                <br />Bạn hãy thử kiểm tra lại chính tả hoặc chọn nhóm sản phẩm khác nhé!
              </p>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleResetFilters}
                id="empty-reset-btn"
              >
                Xem tất cả sản phẩm
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
