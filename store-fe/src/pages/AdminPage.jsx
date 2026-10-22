import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from '../components/Toast';
import { getProductImage, handleImageError } from '../utils/imageHelper';
import { formatCategoryName, formatCategoryDescription, formatProductName } from '../utils/categoryHelper';
import './AdminPage.css';

/* ────────────────────────────────────────────
   Constants & Helpers
──────────────────────────────────────────── */
const ORDER_STATUS_MAP = {
  PENDING:   { label: 'Chờ xác nhận',   color: '#fbbf24', icon: '⏳' },
  CONFIRMED: { label: 'Đã xác nhận',    color: 'var(--color-secondary)', icon: '✅' },
  SHIPPING:  { label: 'Đang giao hàng', color: 'var(--color-accent-purple)', icon: '🚚' },
  COMPLETED: { label: 'Hoàn thành',     color: 'var(--color-success)', icon: '🎉' },
  CANCELLED: { label: 'Đã hủy',         color: 'var(--color-error)', icon: '❌' },
};

const SIZE_LABELS = { M: 'Size M', L: 'Size L', XL: 'Size XL' };
const ICE_LABELS = {
  HOT: 'Nóng',
  LESS_ICE: 'Ít đá (30%)',
  NORMAL_ICE: 'Đá vừa (70%)',
  FULL_ICE: 'Đầy đá (100%)',
};

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value ?? 0);
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShippingInfo(val) {
  if (!val || typeof val !== 'string' || !val.trim()) {
    return 'Chưa có thông tin';
  }
  return val.trim();
}

const FREESHIP_THRESHOLD = 150000;

function getShippingFeeDisplay(order) {
  const subtotal = Number(order?.subtotal ?? 0);
  const discount = Number(order?.discountAmount ?? 0);
  const total = Number(order?.totalAmount ?? 0);
  const diff = Math.max(0, total - subtotal + discount);

  if (diff > 0) {
    return { text: formatMoney(diff), isFree: false };
  }
  if (subtotal >= FREESHIP_THRESHOLD) {
    return { text: 'Miễn phí', isFree: true };
  }
  return { text: '0đ', isFree: false };
}

function getPromotionStatus(p) {
  if (p.status !== 'ACTIVE') {
    return { label: '○ Đã tắt', className: 'badge-inactive' };
  }
  const now = new Date();
  if (p.startAt) {
    const startDate = new Date(p.startAt);
    if (now < startDate) {
      return { label: '⏳ Chưa bắt đầu', className: 'badge-pending' };
    }
  }
  if (p.endAt) {
    const endDate = new Date(p.endAt);
    if (now > endDate) {
      return { label: '⏰ Hết hạn', className: 'badge-expired' };
    }
  }
  return { label: '● Đang hiệu lực', className: 'badge-active' };
}

function formatDateTimeInput(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ────────────────────────────────────────────
   1. STATS TAB (DASHBOARD)
──────────────────────────────────────────── */
function StatsTab() {
  const [stats, setStats] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [productStats, setProductStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getAdminStats(),
      api.getOrderStats().catch(() => null),
      api.getProductStats().catch(() => []),
    ])
      .then(([s, os, ps]) => {
        setStats(s);
        setOrderStats(os);
        setProductStats(Array.isArray(ps) ? ps : []);
      })
      .catch((err) => toast(err.message || 'Không thể tải thống kê', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" /> Đang tải dữ liệu thống kê...
      </div>
    );
  }

  if (!stats) {
    return <div className="admin-empty-state">Không có dữ liệu thống kê</div>;
  }

  const cards = [
    { label: 'Doanh thu thực thu (COMPLETED)', value: formatMoney(stats.totalRevenue), icon: '💰' },
    { label: 'Tổng đơn hàng', value: stats.totalOrders ?? 0, icon: '📦' },
    {
      label: 'Tổng sản phẩm',
      value: stats.activeProducts !== undefined
        ? `${stats.totalProducts ?? 0} (${stats.activeProducts} đang bán)`
        : (stats.totalProducts ?? 0),
      icon: '🧋',
    },
    { label: 'Tổng người dùng', value: stats.totalUsers ?? 0, icon: '👥' },
  ];

  const sortedTopProducts = [...productStats]
    .sort((a, b) => Number(b.totalQuantitySold ?? b.totalQuantity ?? 0) - Number(a.totalQuantitySold ?? a.totalQuantity ?? 0))
    .slice(0, 5);

  return (
    <div>
      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div className="admin-stat-card" key={c.label}>
            <span className="admin-stat-card__icon">{c.icon}</span>
            <div>
              <strong className="admin-stat-card__value">{c.value}</strong>
              <p className="admin-stat-card__label">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-sections">
        {/* Phân loại đơn hàng */}
        <div className="admin-dash-panel">
          <h3 className="admin-dash-panel__title">📊 Đơn hàng theo trạng thái</h3>
          {orderStats ? (
            <div className="admin-order-stats-list">
              <div className="admin-order-stat-row">
                <span>⏳ Chờ xác nhận (PENDING)</span>
                <strong>{orderStats.pending ?? 0} đơn</strong>
              </div>
              <div className="admin-order-stat-row">
                <span>✅ Đã xác nhận (CONFIRMED)</span>
                <strong>{orderStats.confirmed ?? 0} đơn</strong>
              </div>
              <div className="admin-order-stat-row">
                <span>🚚 Đang giao hàng (SHIPPING)</span>
                <strong>{orderStats.shipping ?? 0} đơn</strong>
              </div>
              <div className="admin-order-stat-row">
                <span>🎉 Hoàn thành (COMPLETED)</span>
                <strong style={{ color: 'var(--color-success)' }}>{orderStats.completed ?? 0} đơn</strong>
              </div>
              <div className="admin-order-stat-row">
                <span>❌ Đã hủy (CANCELLED)</span>
                <strong style={{ color: 'var(--color-error)' }}>{orderStats.cancelled ?? 0} đơn</strong>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Chưa có dữ liệu trạng thái đơn hàng</p>
          )}
        </div>

        {/* Top sản phẩm bán chạy */}
        <div className="admin-dash-panel">
          <h3 className="admin-dash-panel__title">
            🏆 Top sản phẩm bán chạy
            <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
              (Tạm tính theo món)
            </span>
          </h3>
          {sortedTopProducts.length > 0 ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đã bán</th>
                    <th>Doanh thu (Tạm tính)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTopProducts.map((p) => {
                    const qty = p.totalQuantitySold ?? p.totalQuantity ?? 0;
                    const revenue = p.totalRevenue ?? 0;
                    return (
                      <tr key={p.productId}>
                        <td><strong>{formatProductName(p.productName)}</strong></td>
                        <td>{qty} ly</td>
                        <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                          {formatMoney(revenue)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Chưa có dữ liệu sản phẩm bán chạy</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   2. PRODUCTS TAB
──────────────────────────────────────────── */
function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = đóng form, {} = thêm, {...} = sửa
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.getProducts({ all: true }),
      api.getCategories({ all: true }),
    ])
      .then(([p, c]) => {
        setProducts(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setForm({
      name: '',
      price: '',
      stockQuantity: 100,
      categoryId: categories[0]?.id || '',
      imageUrl: '',
      description: '',
    });
    setEditing({});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || '',
      price: p.price ?? '',
      stockQuantity: p.stockQuantity ?? 0,
      categoryId: p.category?.id ?? p.category ?? p.categoryId ?? '',
      imageUrl: p.imageUrl || '',
      description: p.description || '',
    });
    setEditing(p);
  };

  const closeForm = () => {
    setEditing(null);
    setForm({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên sản phẩm', 'error'); return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      toast('Giá sản phẩm không hợp lệ', 'error'); return;
    }
    if (form.stockQuantity === '' || Number(form.stockQuantity) < 0) {
      toast('Số lượng tồn kho không hợp lệ', 'error'); return;
    }
    if (!form.categoryId) {
      toast('Vui lòng chọn danh mục cho sản phẩm', 'error'); return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      stockQuantity: Number(form.stockQuantity),
      category: Number(form.categoryId),
      imageUrl: form.imageUrl.trim() || null,
      description: form.description.trim(),
    };

    try {
      if (editing?.id) {
        await api.updateProduct(editing.id, payload);
        toast('Đã cập nhật sản phẩm', 'success');
      } else {
        await api.createProduct(payload);
        toast('Đã thêm sản phẩm mới', 'success');
      }
      closeForm();
      loadData();
    } catch (err) {
      toast(err.message || 'Lưu sản phẩm thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const isDeactivating = currentStatus === 'ACTIVE';
    const msg = isDeactivating
      ? 'Chuyển sản phẩm này sang trạng thái NGỪNG BÁN (INACTIVE)?'
      : 'Kích hoạt mở bán lại sản phẩm này?';

    if (!window.confirm(msg)) return;

    try {
      await api.deactivateProduct(id);
      toast(isDeactivating ? 'Đã chuyển sang Ngừng bán' : 'Đã mở bán lại', 'success');
      loadData();
    } catch (err) {
      toast(err.message || 'Thao tác thất bại', 'error');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" /> Đang tải danh sách sản phẩm...
      </div>
    );
  }

  return (
    <div>
      <div className="admin-tab-header">
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Quản lý Sản phẩm ({products.length})</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Quản lý thông tin, giá, tồn kho và trạng thái mở bán
          </span>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="admin-add-product-btn">
          + Thêm sản phẩm mới
        </button>
      </div>

      {editing && (
        <form className="admin-form" onSubmit={handleSave}>
          <h3>{editing.id ? '✏️ Chỉnh sửa sản phẩm' : '➕ Thêm sản phẩm mới'}</h3>
          <div className="admin-form-grid">
            <label>
              Tên sản phẩm *
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="VD: Trà Sữa Trân Châu Hoàng Gia"
                required
              />
            </label>
            <label>
              Danh mục *
              <select name="categoryId" value={form.categoryId} onChange={handleFormChange} required>
                <option value="">-- Chọn danh mục --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} {c.status === 'INACTIVE' ? '(Ngừng hoạt động)' : ''}</option>
                ))}
              </select>
            </label>
            <label>
              Giá niêm yết (VNĐ) *
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleFormChange}
                placeholder="VD: 35000"
                min="0"
                required
              />
            </label>
            <label>
              Số lượng tồn kho *
              <input
                type="number"
                name="stockQuantity"
                value={form.stockQuantity}
                onChange={handleFormChange}
                placeholder="VD: 100"
                min="0"
                required
              />
            </label>
            <label className="admin-form-full">
              URL hình ảnh
              <input
                name="imageUrl"
                value={form.imageUrl}
                onChange={handleFormChange}
                placeholder="https://... hoặc /images/products/..."
              />
            </label>
            <label className="admin-form-full">
              Mô tả sản phẩm
              <textarea
                name="description"
                value={form.description}
                onChange={handleFormChange}
                rows={3}
                placeholder="Hương vị, thành phần nguyên liệu..."
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="btn btn-ghost" onClick={closeForm}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : (editing.id ? 'Cập nhật' : 'Tạo sản phẩm')}
            </button>
          </div>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ảnh</th>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Giá bán</th>
              <th>Tồn kho</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const img = getProductImage(p);
              const isActive = p.status === 'ACTIVE';

              return (
                <tr key={p.id}>
                  <td>
                    {img ? (
                      <img src={img} alt={p.name} className="admin-thumb" onError={handleImageError} />
                    ) : (
                      <div className="admin-thumb-placeholder">🧋</div>
                    )}
                  </td>
                  <td><strong>{formatProductName(p.name)}</strong></td>
                  <td>{formatCategoryName(p.categoryName) || '—'}</td>
                  <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{formatMoney(p.price)}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: p.stockQuantity < 10 ? 'var(--color-error)' : 'inherit' }}>
                      {p.stockQuantity} ly
                    </span>
                  </td>
                  <td>
                    <span className={isActive ? 'badge-active' : 'badge-inactive'}>
                      {isActive ? '● Đang bán' : '○ Ngừng bán'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                        ✏️ Sửa
                      </button>
                      <button
                        className={`btn btn-ghost btn-sm ${isActive ? 'admin-btn-danger' : ''}`}
                        onClick={() => handleToggleStatus(p.id, p.status)}
                      >
                        {isActive ? '🔒 Ngừng bán' : '🔓 Mở bán'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   3. CATEGORIES TAB
──────────────────────────────────────────── */
function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    api.getCategories({ all: true })
      .then((list) => setCategories(Array.isArray(list) ? list : []))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setForm({ name: '', description: '' });
    setEditing({});
  };

  const openEdit = (c) => {
    setForm({ name: c.name || '', description: c.description || '' });
    setEditing(c);
  };

  const closeForm = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên danh mục', 'error'); return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
    };

    try {
      if (editing?.id) {
        await api.updateCategory(editing.id, payload);
        toast('Đã cập nhật danh mục', 'success');
      } else {
        await api.createCategory(payload);
        toast('Đã thêm danh mục mới', 'success');
      }
      closeForm();
      loadData();
    } catch (err) {
      toast(err.message || 'Lưu danh mục thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const isDeactivating = currentStatus === 'ACTIVE';
    const msg = isDeactivating
      ? 'Chuyển danh mục này sang trạng thái NGỪNG HOẠT ĐỘNG (INACTIVE)?'
      : 'Kích hoạt lại danh mục này?';

    if (!window.confirm(msg)) return;

    try {
      await api.deactivateCategory(id);
      toast(isDeactivating ? 'Đã tắt danh mục' : 'Đã kích hoạt lại', 'success');
      loadData();
    } catch (err) {
      toast(err.message || 'Thao tác thất bại', 'error');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" /> Đang tải danh mục...
      </div>
    );
  }

  return (
    <div>
      <div className="admin-tab-header">
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Quản lý Danh mục ({categories.length})</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Quản lý các nhóm đồ uống và trạng thái hoạt động
          </span>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="admin-add-category-btn">
          + Thêm danh mục mới
        </button>
      </div>

      {editing && (
        <form className="admin-form" onSubmit={handleSave}>
          <h3>{editing.id ? '✏️ Chỉnh sửa danh mục' : '➕ Thêm danh mục mới'}</h3>
          <div className="admin-form-grid">
            <label className="admin-form-full">
              Tên danh mục *
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="VD: Trà Sữa Truyền Thống, Trà Trái Cây..."
                required
              />
            </label>
            <label className="admin-form-full">
              Mô tả danh mục
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Mô tả nhóm sản phẩm..."
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="btn btn-ghost" onClick={closeForm}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : (editing.id ? 'Cập nhật' : 'Tạo danh mục')}
            </button>
          </div>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên danh mục</th>
              <th>Mô tả</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => {
              const isActive = c.status === 'ACTIVE';
              return (
                <tr key={c.id}>
                  <td>#{c.id}</td>
                  <td><strong>{formatCategoryName(c.name)}</strong></td>
                  <td>{formatCategoryDescription(c.description, c.name) || '—'}</td>
                  <td>
                    <span className={isActive ? 'badge-active' : 'badge-inactive'}>
                      {isActive ? '● Đang hoạt động' : '○ Ngừng hoạt động'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                        ✏️ Sửa
                      </button>
                      <button
                        className={`btn btn-ghost btn-sm ${isActive ? 'admin-btn-danger' : ''}`}
                        onClick={() => handleToggleStatus(c.id, c.status)}
                      >
                        {isActive ? '🔒 Tắt' : '🔓 Bật'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   4. ORDERS TAB (WITH ORDER DETAIL MODAL & TRANSITIONS)
──────────────────────────────────────────── */
function AdminOrderDetailModal({ order, onClose, onStatusChange }) {
  if (!order) return null;

  return (
    <div className="admin-modal">
      <div className="admin-modal__backdrop" onClick={onClose} />
      <div className="admin-modal__box">
        <div className="admin-modal__header">
          <span className="admin-modal__title">Chi tiết đơn hàng #{order.id}</span>
          <button className="admin-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal__body">
          {/* Thông tin đơn */}
          <div className="admin-info-grid">
            <div className="admin-info-item">
              <span className="admin-info-item__label">Trạng thái</span>
              <span className="admin-info-item__value">
                <span
                  style={{
                    color: ORDER_STATUS_MAP[order.status]?.color || 'inherit',
                    fontWeight: 700,
                  }}
                >
                  {ORDER_STATUS_MAP[order.status]?.icon} {ORDER_STATUS_MAP[order.status]?.label || order.status}
                </span>
              </span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-item__label">Ngày tạo</span>
              <span className="admin-info-item__value">{formatDate(order.createdAt)}</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-item__label">Người nhận</span>
              <span className="admin-info-item__value">{formatShippingInfo(order.receiverName)}</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-item__label">Số điện thoại</span>
              <span className="admin-info-item__value">{formatShippingInfo(order.receiverPhone)}</span>
            </div>
            <div className="admin-info-item admin-info-item--full">
              <span className="admin-info-item__label">Địa chỉ giao hàng</span>
              <span className="admin-info-item__value">{formatShippingInfo(order.shippingAddress)}</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-item__label">Phương thức thanh toán</span>
              <span className="admin-info-item__value">
                {order.paymentMethod === 'COD' ? '💵 Tiền mặt khi nhận (COD)' : order.paymentMethod}
              </span>
            </div>
          </div>

          {/* Danh sách sản phẩm */}
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
              Sản phẩm ({order.items?.length || 0})
            </h4>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Món</th>
                    <th>Cấu hình</th>
                    <th>Đơn giá</th>
                    <th>SL</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it, idx) => {
                    const opts = [
                      it.size && (SIZE_LABELS[it.size] || `Size ${it.size}`),
                      it.sweetness !== null && it.sweetness !== undefined
                        && (it.sweetness === 0 ? 'Không ngọt (0%)' : `${it.sweetness}% ngọt`),
                      it.ice && (ICE_LABELS[it.ice] || it.ice),
                      it.toppings && Array.isArray(it.toppings) && it.toppings.length > 0
                        && `Topping: ${it.toppings.map((t) => t.name || t).join(', ')}`,
                    ].filter(Boolean).join(' · ');

                    return (
                      <tr key={idx}>
                        <td><strong>{it.productName || it.name || 'Sản phẩm'}</strong></td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{opts || 'Tiêu chuẩn'}</td>
                        <td>{formatMoney(it.unitPrice)}</td>
                        <td>x{it.quantity}</td>
                        <td style={{ fontWeight: 600 }}>{formatMoney(it.lineTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tổng tiền */}
          {(() => {
            const shipping = getShippingFeeDisplay(order);
            return (
              <div style={{ background: 'var(--color-bg-glass)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                  <span>Tạm tính</span>
                  <span>{formatMoney(order.subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                  <span>Phí vận chuyển</span>
                  <span style={shipping.isFree ? { color: 'var(--color-success)', fontWeight: 600 } : {}}>
                    {shipping.text}
                  </span>
                </div>
                {order.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', color: 'var(--color-success)' }}>
                    <span>Giảm giá</span>
                    <span>-{formatMoney(order.discountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--color-border)', fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary)' }}>
                  <span>Tổng thanh toán</span>
                  <span>{formatMoney(order.totalAmount)}</span>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadOrders = useCallback(() => {
    setLoading(true);
    api.getAdminOrders()
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateOrderStatus(id, status);
      toast(`Đã cập nhật đơn #${id} sang ${ORDER_STATUS_MAP[status]?.label || status}`, 'success');
      loadOrders();
      if (selectedOrder?.id === id) {
        setSelectedOrder((prev) => ({ ...prev, status }));
      }
    } catch (err) {
      toast(err.message || 'Không thể cập nhật trạng thái', 'error');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" /> Đang tải danh sách đơn hàng...
      </div>
    );
  }

  return (
    <div>
      <div className="admin-tab-header">
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Quản lý Đơn hàng ({orders.length})</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Xử lý chuyển trạng thái: PENDING → CONFIRMED/CANCELLED → SHIPPING → COMPLETED
          </span>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Người nhận</th>
              <th>SĐT</th>
              <th>Địa chỉ</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Cập nhật trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const statusInfo = ORDER_STATUS_MAP[o.status] || { label: o.status, color: 'inherit', icon: '•' };

              return (
                <tr key={o.id}>
                  <td><strong>#{o.id}</strong></td>
                  <td><strong>{formatShippingInfo(o.receiverName)}</strong></td>
                  <td>{formatShippingInfo(o.receiverPhone)}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.shippingAddress}>
                    {formatShippingInfo(o.shippingAddress)}
                  </td>
                  <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    {formatMoney(o.totalAmount)}
                  </td>
                  <td>
                    <span style={{ color: statusInfo.color, fontWeight: 700, fontSize: '0.82rem' }}>
                      {statusInfo.icon} {statusInfo.label}
                    </span>
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>
                    {/* Quy tắc chuyển đổi trạng thái */}
                    <div className="order-transition-actions">
                      {o.status === 'PENDING' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleStatusChange(o.id, 'CONFIRMED')}
                            title="Xác nhận đơn"
                          >
                            Xác nhận
                          </button>
                          <button
                            className="btn btn-ghost btn-sm admin-btn-danger"
                            onClick={() => handleStatusChange(o.id, 'CANCELLED')}
                            title="Hủy đơn"
                          >
                            Hủy
                          </button>
                        </>
                      )}

                      {o.status === 'CONFIRMED' && (
                        <>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStatusChange(o.id, 'SHIPPING')}
                            title="Bắt đầu giao hàng"
                          >
                            Giao hàng
                          </button>
                          <button
                            className="btn btn-ghost btn-sm admin-btn-danger"
                            onClick={() => handleStatusChange(o.id, 'CANCELLED')}
                            title="Hủy đơn"
                          >
                            Hủy
                          </button>
                        </>
                      )}

                      {o.status === 'SHIPPING' && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          onClick={() => handleStatusChange(o.id, 'COMPLETED')}
                          title="Hoàn thành đơn"
                        >
                          Hoàn thành
                        </button>
                      )}

                      {(o.status === 'COMPLETED' || o.status === 'CANCELLED') && (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          — Kết thúc —
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedOrder(o)}
                    >
                      Chi tiết →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedOrder && (
        <AdminOrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   5. USERS TAB
──────────────────────────────────────────── */
function AdminUserDetailModal({ user, onClose }) {
  if (!user) return null;

  return (
    <div className="admin-modal">
      <div className="admin-modal__backdrop" onClick={onClose} />
      <div className="admin-modal__box" style={{ maxWidth: '480px' }}>
        <div className="admin-modal__header">
          <span className="admin-modal__title">Thông tin người dùng #{user.id}</span>
          <button className="admin-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal__body">
          <div className="admin-info-grid">
            <div className="admin-info-item admin-info-item--full">
              <span className="admin-info-item__label">Họ và tên</span>
              <span className="admin-info-item__value">{user.fullName || '—'}</span>
            </div>
            <div className="admin-info-item admin-info-item--full">
              <span className="admin-info-item__label">Email</span>
              <span className="admin-info-item__value">{user.email}</span>
            </div>
            <div className="admin-info-item admin-info-item--full">
              <span className="admin-info-item__label">Số điện thoại</span>
              <span className="admin-info-item__value">{user.phone || 'Chưa cập nhật'}</span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-item__label">Vai trò</span>
              <span className="admin-info-item__value">
                <span className={user.role === 'ADMIN' ? 'badge-admin-role' : 'badge-user-role'}>
                  {user.role}
                </span>
              </span>
            </div>
            <div className="admin-info-item">
              <span className="admin-info-item__label">Trạng thái</span>
              <span className="admin-info-item__value">
                <span className={user.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}>
                  {user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = useCallback(() => {
    setLoading(true);
    api.getAdminUsers()
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleToggleStatus = async (id, currentStatus) => {
    const isLocking = currentStatus === 'ACTIVE';
    if (!window.confirm(isLocking ? 'Bạn có chắc muốn KHÓA tài khoản này?' : 'MỞ KHÓA tài khoản này?')) return;

    try {
      await api.toggleUserStatus(id);
      toast(isLocking ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', 'success');
      loadUsers();
    } catch (err) {
      toast(err.message || 'Thao tác thất bại', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (u.fullName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const phone = (u.phone || '').toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" /> Đang tải danh sách người dùng...
      </div>
    );
  }

  return (
    <div>
      <div className="admin-tab-header">
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Quản lý Người dùng ({users.length})</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Xem thông tin, phân quyền và khóa/mở khóa tài khoản (không xóa)
          </span>
        </div>
        <div className="admin-search-wrap">
          <input
            type="text"
            placeholder="🔍 Tìm theo tên hoặc email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => setSearchQuery('')}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                  Không tìm thấy người dùng nào phù hợp với "{searchQuery}"
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isActive = u.status === 'ACTIVE';
                const isAdmin = u.role === 'ADMIN';

                return (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td><strong>{u.fullName || '—'}</strong></td>
                    <td>{u.email}</td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <span className={isAdmin ? 'badge-admin-role' : 'badge-user-role'}>
                        {isAdmin ? '👑 ADMIN' : '👤 CUSTOMER'}
                      </span>
                    </td>
                    <td>
                      <span className={isActive ? 'badge-active' : 'badge-inactive'}>
                        {isActive ? '● Hoạt động' : '○ Đã khóa'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedUser(u)}
                        >
                          👁️ Chi tiết
                        </button>
                        <button
                          className={`btn btn-ghost btn-sm ${isActive ? 'admin-btn-danger' : ''}`}
                          onClick={() => handleToggleStatus(u.id, u.status)}
                        >
                          {isActive ? '🔒 Khóa' : '🔓 Mở khóa'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <AdminUserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────
   6. PROMOTIONS TAB
──────────────────────────────────────────── */
function PromotionsTab() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    api.getPromotions()
      .then((data) => setPromotions(Array.isArray(data) ? data : []))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setForm({
      code: '',
      name: '',
      discountType: 'PERCENT',
      discountValue: '',
      minOrderValue: '',
      maxDiscountValue: '',
      startAt: '',
      endAt: '',
    });
    setEditing({});
  };

  const openEdit = (p) => {
    setForm({
      code: p.code || '',
      name: p.name || '',
      discountType: p.discountType || 'PERCENT',
      discountValue: p.discountValue ?? '',
      minOrderValue: p.minOrderValue ?? '',
      maxDiscountValue: p.maxDiscountValue ?? '',
      startAt: formatDateTimeInput(p.startAt),
      endAt: formatDateTimeInput(p.endAt),
    });
    setEditing(p);
  };

  const closeForm = () => {
    setEditing(null);
    setForm({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast('Vui lòng nhập mã khuyến mãi', 'error'); return;
    }
    if (!form.name.trim()) {
      toast('Vui lòng nhập tên chương trình khuyến mãi', 'error'); return;
    }
    if (form.discountValue === '' || Number(form.discountValue) <= 0) {
      toast('Giá trị giảm phải lớn hơn 0', 'error'); return;
    }
    if (form.discountType === 'PERCENT' && Number(form.discountValue) > 100) {
      toast('Phần trăm giảm giá không được vượt quá 100%', 'error'); return;
    }

    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderValue: form.minOrderValue !== '' ? Number(form.minOrderValue) : null,
      maxDiscountValue: form.maxDiscountValue !== '' ? Number(form.maxDiscountValue) : null,
      startAt: form.startAt ? form.startAt : null,
      endAt: form.endAt ? form.endAt : null,
    };

    try {
      if (editing?.id) {
        await api.updatePromotion(editing.id, payload);
        toast('Đã cập nhật khuyến mãi', 'success');
      } else {
        await api.createPromotion(payload);
        toast('Đã thêm khuyến mãi mới', 'success');
      }
      closeForm();
      loadData();
    } catch (err) {
      toast(err.message || 'Lưu khuyến mãi thất bại', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const isDeactivating = currentStatus === 'ACTIVE';
    const msg = isDeactivating
      ? 'Chuyển mã khuyến mãi này sang trạng thái NGỪNG ÁP DỤNG?'
      : 'Kích hoạt lại mã khuyến mãi này?';

    if (!window.confirm(msg)) return;

    try {
      await api.deactivatePromotion(id);
      toast(isDeactivating ? 'Đã tắt mã khuyến mãi' : 'Đã kích hoạt lại mã', 'success');
      loadData();
    } catch (err) {
      toast(err.message || 'Thao tác thất bại', 'error');
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" /> Đang tải danh sách khuyến mãi...
      </div>
    );
  }

  return (
    <div>
      <div className="admin-tab-header">
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Quản lý Khuyến mãi ({promotions.length})</h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            Mã voucher, giảm theo % hoặc số tiền cố định, thời hạn và giá trị đơn tối thiểu
          </span>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="admin-add-promo-btn">
          + Thêm mã khuyến mãi
        </button>
      </div>

      {editing && (
        <form className="admin-form" onSubmit={handleSave}>
          <h3>{editing.id ? '✏️ Chỉnh sửa mã khuyến mãi' : '➕ Tạo mã khuyến mãi mới'}</h3>
          <div className="admin-form-grid">
            <label>
              Mã khuyến mãi (Code) *
              <input
                name="code"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="VD: TEABLISS20, CHAOHEXANH"
                style={{ textTransform: 'uppercase', fontWeight: 600 }}
                required
              />
            </label>
            <label>
              Tên chương trình *
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="VD: Giảm 20% cho đơn hàng đầu tiên"
                required
              />
            </label>
            <label>
              Loại giảm giá *
              <select name="discountType" value={form.discountType} onChange={handleFormChange}>
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định (VNĐ)</option>
              </select>
            </label>
            <label>
              Giá trị giảm ({form.discountType === 'PERCENT' ? '%' : 'VNĐ'}) *
              <input
                type="number"
                name="discountValue"
                value={form.discountValue}
                onChange={handleFormChange}
                placeholder={form.discountType === 'PERCENT' ? 'VD: 20' : 'VD: 30000'}
                min="1"
                max={form.discountType === 'PERCENT' ? 100 : undefined}
                required
              />
            </label>
            <label>
              Đơn hàng tối thiểu (VNĐ)
              <input
                type="number"
                name="minOrderValue"
                value={form.minOrderValue}
                onChange={handleFormChange}
                placeholder="VD: 100000"
                min="0"
              />
            </label>
            <label>
              Mức giảm tối đa (VNĐ - chỉ áp dụng khi giảm %)
              <input
                type="number"
                name="maxDiscountValue"
                value={form.maxDiscountValue}
                onChange={handleFormChange}
                placeholder="VD: 50000"
                min="0"
                disabled={form.discountType === 'FIXED'}
              />
            </label>
            <label>
              Ngày bắt đầu hiệu lực
              <input
                type="datetime-local"
                name="startAt"
                value={form.startAt}
                onChange={handleFormChange}
              />
            </label>
            <label>
              Ngày kết thúc
              <input
                type="datetime-local"
                name="endAt"
                value={form.endAt}
                onChange={handleFormChange}
              />
            </label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="btn btn-ghost" onClick={closeForm}>Hủy</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : (editing.id ? 'Cập nhật' : 'Tạo khuyến mãi')}
            </button>
          </div>
        </form>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Mã code</th>
              <th>Tên khuyến mãi</th>
              <th>Loại giảm</th>
              <th>Mức giảm</th>
              <th>Đơn tối thiểu</th>
              <th>Giảm tối đa</th>
              <th>Hiệu lực</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => {
              const isActive = p.status === 'ACTIVE';

              return (
                <tr key={p.id}>
                  <td>
                    <span className="badge badge-gold" style={{ fontSize: '0.85rem' }}>
                      {p.code}
                    </span>
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.discountType === 'PERCENT' ? 'Phần trăm (%)' : 'Số tiền cố định'}</td>
                  <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    {p.discountType === 'PERCENT' ? `${p.discountValue}%` : formatMoney(p.discountValue)}
                  </td>
                  <td>{p.minOrderValue ? formatMoney(p.minOrderValue) : 'Không yêu cầu'}</td>
                  <td>{p.maxDiscountValue ? formatMoney(p.maxDiscountValue) : 'Không giới hạn'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {p.startAt ? formatDate(p.startAt) : 'Ngay lập tức'} <br />
                    → {p.endAt ? formatDate(p.endAt) : 'Vô thời hạn'}
                  </td>
                  <td>
                    {(() => {
                      const promoStatus = getPromotionStatus(p);
                      return (
                        <span className={promoStatus.className}>
                          {promoStatus.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>
                        ✏️ Sửa
                      </button>
                      <button
                        className={`btn btn-ghost btn-sm ${isActive ? 'admin-btn-danger' : ''}`}
                        onClick={() => handleToggleStatus(p.id, p.status)}
                      >
                        {isActive ? '🔒 Tắt' : '🔓 Bật'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN ADMIN PAGE
──────────────────────────────────────────── */
export default function AdminPage() {
  const [tab, setTab] = useState('stats');

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  })();

  // Chặn truy cập nếu chưa đăng nhập hoặc không phải ADMIN
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  const tabs = [
    { id: 'stats', label: '📊 Thống kê' },
    { id: 'orders', label: '📦 Đơn hàng' },
    { id: 'products', label: '🧋 Sản phẩm' },
    { id: 'categories', label: '🏷️ Danh mục' },
    { id: 'users', label: '👥 Người dùng' },
    { id: 'promotions', label: '🎁 Khuyến mãi' },
  ];

  return (
    <div className="admin-page">
      <div className="container">
        <div className="admin-title-row">
          <div>
            <h1 className="admin-title">Bảng Quản Trị TeaBliss</h1>
            <p className="admin-subtitle">
              Xin chào, <strong>{user.fullName || 'Quản trị viên'}</strong> (Quyền hạn: ADMIN)
            </p>
          </div>
        </div>

        <div className="admin-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`admin-tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
              id={`admin-tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-content">
          {tab === 'stats' && <StatsTab />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'products' && <ProductsTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'promotions' && <PromotionsTab />}
        </div>
      </div>
    </div>
  );
}
