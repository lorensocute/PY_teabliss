import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { api } from '../services/api';
import { toast } from './Toast';
import { getCategoryDisplay } from '../utils/categoryHelper';
import './Navbar.css';

export default function Navbar() {
  const { totalItems } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Category dropdown state
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const navigate = useNavigate();

  // Tải danh mục thực tế từ API backend
  const fetchCategories = () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    api.getCategories()
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        } else {
          setCategories([]);
        }
      })
      .catch((err) => {
        console.error('Navbar getCategories error:', err);
        setCategoriesError(err.message || 'Không thể tải danh mục');
        setCategories([]);
      })
      .finally(() => {
        setCategoriesLoading(false);
      });
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Xử lý hover với độ trễ (hover delay) tránh đóng dropdown đột ngột
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setDropdownOpen(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 190);
  };

  // Dọn dẹp timeout khi component unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Đóng category dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Đọc user từ localStorage khi mount và khi storage thay đổi
  useEffect(() => {
    const loadUser = () => {
      try {
        const stored = localStorage.getItem('user');
        setUser(stored ? JSON.parse(stored) : null);
      } catch {
        setUser(null);
      }
    };
    loadUser();

    // Lắng nghe khi localStorage thay đổi (đăng nhập/logout từ tab khác)
    window.addEventListener('storage', loadUser);
    // Custom event để cập nhật ngay trong cùng tab
    window.addEventListener('userChanged', loadUser);
    return () => {
      window.removeEventListener('storage', loadUser);
      window.removeEventListener('userChanged', loadUser);
    };
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, []);

  // Đóng user dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setMenuOpen(false);
    try {
      await api.logout();
    } catch {
      // Bỏ qua lỗi logout phía server, vẫn xóa local
    }
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('userChanged'));
    toast('Đã đăng xuất thành công', 'success');
    navigate('/');
  };

  // Lấy chữ viết tắt tên để hiển thị avatar
  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar__inner">
          {/* Logo */}
          <Link to="/" className="navbar__logo">
            <span className="navbar__logo-icon">🧋</span>
            <span className="navbar__logo-text">
              Tea<span className="navbar__logo-accent">Bliss</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <ul className="navbar__links">
            <li>
              <NavLink to="/" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`} end>
                Trang Chủ
              </NavLink>
            </li>
            <li
              className={`navbar__dropdown ${dropdownOpen ? 'is-open' : ''}`}
              ref={dropdownRef}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="navbar__dropdown-trigger">
                <NavLink
                  to="/products"
                  className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    setDropdownOpen(false);
                  }}
                  id="nav-menu-link"
                >
                  Thực Đơn
                </NavLink>
                <button
                  type="button"
                  className="navbar__chevron-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    setDropdownOpen((prev) => !prev);
                  }}
                  aria-label="Mở danh mục thực đơn"
                  aria-expanded={dropdownOpen}
                  id="nav-dropdown-toggle-btn"
                >
                  <span className={`navbar__chevron ${dropdownOpen ? 'rotate' : ''}`}>▾</span>
                </button>
              </div>

              <div className="navbar__dropdown-menu" role="menu" aria-label="Danh mục thực đơn">
                {categoriesLoading ? (
                  <div className="navbar__dropdown-state navbar__dropdown-state--loading">
                    <span className="navbar__dropdown-spinner" />
                    <span>Đang tải danh mục...</span>
                  </div>
                ) : categoriesError ? (
                  <div className="navbar__dropdown-state navbar__dropdown-state--error">
                    <span>⚠️ Không tải được danh mục</span>
                    <button
                      type="button"
                      className="navbar__dropdown-retry-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchCategories();
                      }}
                    >
                      Thử lại
                    </button>
                  </div>
                ) : categories.length === 0 ? (
                  <div className="navbar__dropdown-state navbar__dropdown-state--empty">
                    <span>Chưa có danh mục nào</span>
                  </div>
                ) : (
                  categories.map((cat) => {
                    const meta = getCategoryDisplay(cat);
                    return (
                      <Link
                        key={cat.id}
                        to={`/products?categoryId=${cat.id}`}
                        className="navbar__dropdown-item"
                        onClick={() => {
                          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                          setDropdownOpen(false);
                        }}
                        id={`nav-cat-item-${cat.id}`}
                      >
                        <span className="navbar__dropdown-icon">{meta.icon}</span>
                        <span className="navbar__dropdown-name">{meta.name}</span>
                      </Link>
                    );
                  })
                )}
              </div>
            </li>
            <li>
              <NavLink to="/products?tag=bestseller" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
                Bán Chạy
              </NavLink>
            </li>
            <li>
              <NavLink to="/products?tag=new" className={({ isActive }) => `navbar__link ${isActive ? 'active' : ''}`}>
                Mới Ra Mắt
              </NavLink>
            </li>
          </ul>

          {/* Actions */}
          <div className="navbar__actions">
            <button
              className="navbar__icon-btn"
              id="search-btn"
              onClick={() => setSearchOpen(true)}
              aria-label="Tìm kiếm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {/* Khu vực tài khoản */}
            {user ? (
              <div className="navbar__user" ref={userMenuRef}>
                <button
                  className="navbar__user-btn"
                  id="user-menu-btn"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="Tài khoản"
                  aria-expanded={userMenuOpen}
                >
                  <span className="navbar__user-avatar">{getInitials(user.fullName)}</span>
                  <span className="navbar__user-name">{user.fullName.split(' ').slice(-1)[0]}</span>
                  <span className="navbar__chevron" style={{ fontSize: '0.75rem', opacity: 0.6 }}>▾</span>
                </button>

                {userMenuOpen && (
                  <div className="navbar__user-menu" id="user-dropdown">
                    <div className="navbar__user-menu-header">
                      <span className="navbar__user-avatar navbar__user-avatar--lg">
                        {getInitials(user.fullName)}
                      </span>
                      <div>
                        <div className="navbar__user-menu-name">{user.fullName}</div>
                        <div className="navbar__user-menu-email">{user.email}</div>
                      </div>
                    </div>
                    <div className="navbar__user-menu-divider" />
                    {user.role === 'ADMIN' && (
                      <Link
                        to="/admin"
                        className="navbar__user-menu-item navbar__user-menu-item--admin"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                        </svg>
                        Trang Quản Trị
                      </Link>
                    )}
                    <Link
                      to="/profile"
                      className="navbar__user-menu-item"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                      Thông tin tài khoản
                    </Link>
                    <Link
                      to="/orders"
                      className="navbar__user-menu-item"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                      Đơn hàng của tôi
                    </Link>
                    <div className="navbar__user-menu-divider" />
                    <button
                      className="navbar__user-menu-item navbar__user-menu-item--logout"
                      onClick={handleLogout}
                      id="logout-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="navbar__icon-btn" aria-label="Tài khoản">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </Link>
            )}

            <Link to="/cart" className="navbar__icon-btn navbar__cart-btn" id="cart-btn" aria-label="Giỏ hàng">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {totalItems > 0 && (
                <span className="navbar__cart-count">{totalItems > 99 ? '99+' : totalItems}</span>
              )}
            </Link>

            <Link to="/checkout" className="btn btn-primary btn-sm navbar__order-btn" id="order-now-btn">
              Đặt Ngay
            </Link>

            {/* Hamburger */}
            <button
              className={`navbar__hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              id="hamburger-btn"
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`} id="mobile-menu">
        <div className="mobile-menu__overlay" onClick={() => setMenuOpen(false)} />
        <div className="mobile-menu__panel">
          <div className="mobile-menu__header">
            <span className="navbar__logo-text">🧋 Tea<span className="navbar__logo-accent">Bliss</span></span>
            <button onClick={() => setMenuOpen(false)} className="mobile-menu__close">✕</button>
          </div>
          <nav className="mobile-menu__nav">
            <Link to="/" onClick={() => setMenuOpen(false)} className="mobile-menu__link">🏠 Trang Chủ</Link>
            <Link to="/products" onClick={() => setMenuOpen(false)} className="mobile-menu__link">☕ Tất Cả Thực Đơn</Link>
            {categoriesLoading ? (
              <div className="mobile-menu__sublink mobile-menu__sublink--loading">
                <span className="navbar__dropdown-spinner" style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Đang tải danh mục...</span>
              </div>
            ) : (
              categories.map((cat) => {
                const meta = getCategoryDisplay(cat);
                return (
                  <Link
                    key={cat.id}
                    to={`/products?categoryId=${cat.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="mobile-menu__link mobile-menu__sublink"
                    id={`mobile-cat-${cat.id}`}
                  >
                    <span className="mobile-menu__sublink-icon">{meta.icon}</span>
                    <span className="mobile-menu__sublink-name">{meta.name}</span>
                  </Link>
                );
              })
            )}
            <Link to="/products?tag=bestseller" onClick={() => setMenuOpen(false)} className="mobile-menu__link">⭐ Bán Chạy</Link>
            <Link to="/products?tag=new" onClick={() => setMenuOpen(false)} className="mobile-menu__link">✨ Mới Ra Mắt</Link>
            <Link to="/cart" onClick={() => setMenuOpen(false)} className="mobile-menu__link">🛒 Giỏ Hàng {totalItems > 0 && `(${totalItems})`}</Link>

            {user ? (
              <>
                {user.role === 'ADMIN' && (
                  <Link to="/admin" onClick={() => setMenuOpen(false)} className="mobile-menu__link">🛠️ Trang Quản Trị</Link>
                )}
                <Link to="/profile" onClick={() => setMenuOpen(false)} className="mobile-menu__link">👤 Thông tin tài khoản</Link>
                <Link to="/orders" onClick={() => setMenuOpen(false)} className="mobile-menu__link">📦 Đơn hàng của tôi</Link>
                <button
                  className="mobile-menu__link mobile-menu__logout"
                  onClick={handleLogout}
                >
                  🚪 Đăng xuất ({user.fullName.split(' ').slice(-1)[0]})
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="mobile-menu__link">👤 Đăng Nhập / Đăng Ký</Link>
            )}
          </nav>
          <div className="mobile-menu__footer">
            <Link to="/checkout" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setMenuOpen(false)}>
              Đặt Hàng Ngay
            </Link>
          </div>
        </div>
      </div>

      {/* Search Overlay */}
      {searchOpen && (
        <div className="search-overlay animate-fadeIn" id="search-overlay">
          <div className="search-overlay__backdrop" onClick={() => setSearchOpen(false)} />
          <div className="search-overlay__box animate-scaleIn">
            <form onSubmit={handleSearch} className="search-overlay__form">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                id="search-input"
                type="text"
                placeholder="Tìm kiếm trà sữa, trà trái cây..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="search-overlay__input"
              />
              <button type="submit" className="btn btn-primary btn-sm">Tìm</button>
              <button type="button" onClick={() => setSearchOpen(false)} className="search-overlay__close">✕</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
