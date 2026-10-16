import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from '../components/Toast';
import './ProfilePage.css';

/* ────────────────────────────────────────────
   Icon helpers (inline SVG, no extra deps)
──────────────────────────────────────────── */
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconMapPin = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
);
const IconEye = ({ show }) => show ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/* ────────────────────────────────────────────
   Helpers
──────────────────────────────────────────── */
function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatAddress(addr) {
  return [addr.addressDetail, addr.ward, addr.district, addr.city]
    .filter(Boolean).join(', ');
}

/* ────────────────────────────────────────────
   Address Modal
──────────────────────────────────────────── */
const EMPTY_ADDR = {
  receiverName: '', phone: '', addressDetail: '',
  ward: '', district: '', city: '', defaultAddress: false,
};

function AddressModal({ address, onClose, onSave }) {
  const [form, setForm] = useState(
    address
      ? {
          ...EMPTY_ADDR,
          ...address,
          ward: address.ward || '',
          district: address.district || '',
          city: address.city || '',
        }
      : EMPTY_ADDR
  );
  const [saving, setSaving] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.receiverName.trim() || !form.phone.trim() || !form.addressDetail.trim() || !form.city.trim()) {
      toast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error');
      return;
    }
    if (!/^(0[3|5|7|8|9])\d{8}$/.test(form.phone.trim())) {
      toast('Số điện thoại không hợp lệ (VD: 0912345678)', 'error');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-modal">
      <div className="profile-modal__backdrop" onClick={onClose} />
      <div className="profile-modal__box">
        <div className="profile-modal__header">
          <span className="profile-modal__title">
            {address ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}
          </span>
          <button className="profile-modal__close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="profile-modal__body">
            <div className="profile-form__row">
              <div className="form-group">
                <label className="form-label" htmlFor="addr-receiverName">Họ tên người nhận *</label>
                <input
                  id="addr-receiverName"
                  name="receiverName"
                  className="form-input"
                  value={form.receiverName}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="addr-phone">Số điện thoại *</label>
                <input
                  id="addr-phone"
                  name="phone"
                  className="form-input"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="0912 345 678"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="addr-detail">Số nhà, tên đường *</label>
              <input
                id="addr-detail"
                name="addressDetail"
                className="form-input"
                value={form.addressDetail}
                onChange={handleChange}
                placeholder="123 Đường Nguyễn Trãi"
                required
              />
            </div>

            <div className="profile-form__row">
              <div className="form-group">
                <label className="form-label" htmlFor="addr-ward">Phường / Xã</label>
                <input
                  id="addr-ward"
                  name="ward"
                  className="form-input"
                  value={form.ward}
                  onChange={handleChange}
                  placeholder="Phường Bến Thành"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="addr-district">Quận / Huyện</label>
                <input
                  id="addr-district"
                  name="district"
                  className="form-input"
                  value={form.district}
                  onChange={handleChange}
                  placeholder="Quận 1"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="addr-city">Tỉnh / Thành phố *</label>
              <input
                id="addr-city"
                name="city"
                className="form-input"
                value={form.city}
                onChange={handleChange}
                placeholder="TP. Hồ Chí Minh"
                required
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="defaultAddress"
                checked={form.defaultAddress}
                onChange={handleChange}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                Đặt làm địa chỉ mặc định
              </span>
            </label>
          </div>

          <div className="profile-modal__footer">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu địa chỉ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   ProfilePage main component
──────────────────────────────────────────── */
export default function ProfilePage() {
  const navigate = useNavigate();

  // ── Auth guard ──
  const localUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();

  // ── State: profile ──
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [infoForm, setInfoForm] = useState({ fullName: '', phone: '' });
  const [infoSaving, setInfoSaving] = useState(false);

  // ── State: password ──
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwShow, setPwShow] = useState({ old: false, new: false, confirm: false });
  const [pwSaving, setPwSaving] = useState(false);

  // ── State: addresses ──
  const [addresses, setAddresses] = useState([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrModal, setAddrModal] = useState(null); // null | 'new' | addressObject
  const [addrDeleting, setAddrDeleting] = useState(null);

  /* ─── Load profile ─── */
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await api.getProfile();
      setProfile(data);
      setInfoForm({
        fullName: data.fullName || '',
        phone: data.phone || '',
      });
    } catch (err) {
      // 401 hoặc chưa đăng nhập → redirect
      if (!localUser) {
        navigate('/login');
        return;
      }
      toast(err.message || 'Không thể tải thông tin tài khoản', 'error');
      navigate('/login');
    } finally {
      setProfileLoading(false);
    }
  }, [navigate, localUser]);

  /* ─── Load addresses ─── */
  const loadAddresses = useCallback(async () => {
    setAddrLoading(true);
    try {
      const data = await api.getAddresses();
      setAddresses(Array.isArray(data) ? data : []);
    } catch {
      setAddresses([]);
    } finally {
      setAddrLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localUser) { navigate('/login'); return; }
    loadProfile();
    loadAddresses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Save profile info ─── */
  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    if (!infoForm.fullName.trim()) {
      toast('Vui lòng nhập họ tên', 'error'); return;
    }
    setInfoSaving(true);
    try {
      if (infoForm.phone.trim() && !/^(0[3|5|7|8|9])\d{8}$/.test(infoForm.phone.trim())) {
        toast('Số điện thoại không hợp lệ (VD: 0912345678)', 'error');
        setInfoSaving(false);
        return;
      }
      const payload = {
        fullName: infoForm.fullName.trim(),
        phone: infoForm.phone.trim(),
      };
      const updated = await api.updateProfile(payload);

      // Cập nhật state local
      setProfile(prev => ({ ...prev, ...updated }));
      setInfoForm({ fullName: updated.fullName || '', phone: updated.phone || '' });

      // Cập nhật localStorage để Navbar cập nhật ngay
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, fullName: updated.fullName, phone: updated.phone }));
      window.dispatchEvent(new Event('userChanged'));

      toast('Đã cập nhật thông tin thành công!', 'success');
    } catch (err) {
      toast(err.message || 'Cập nhật thất bại', 'error');
    } finally {
      setInfoSaving(false);
    }
  };

  /* ─── Change password ─── */
  const handlePwSubmit = async (e) => {
    e.preventDefault();
    if (!pwForm.oldPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      toast('Vui lòng điền đầy đủ tất cả ô mật khẩu', 'error'); return;
    }
    if (pwForm.newPassword.length < 8) {
      toast('Mật khẩu mới phải có ít nhất 8 ký tự', 'error'); return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast('Mật khẩu xác nhận không khớp', 'error'); return;
    }
    setPwSaving(true);
    try {
      await api.changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      });
      toast('Đổi mật khẩu thành công!', 'success');
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast(err.message || 'Đổi mật khẩu thất bại', 'error');
    } finally {
      setPwSaving(false);
    }
  };

  /* ─── Address handlers ─── */
  const handleAddrSave = async (form) => {
    try {
      if (addrModal && addrModal.id) {
        await api.updateAddress(addrModal.id, form);
        toast('Đã cập nhật địa chỉ', 'success');
      } else {
        await api.createAddress(form);
        toast('Đã thêm địa chỉ mới', 'success');
      }
      setAddrModal(null);
      loadAddresses();
    } catch (err) {
      toast(err.message || 'Lưu địa chỉ thất bại', 'error');
      throw err; // để modal biết đang lỗi
    }
  };

  const handleAddrDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
    setAddrDeleting(id);
    try {
      await api.deleteAddress(id);
      toast('Đã xóa địa chỉ', 'success');
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      toast(err.message || 'Xóa thất bại', 'error');
    } finally {
      setAddrDeleting(null);
    }
  };

  const handleSetDefault = async (addr) => {
    try {
      await api.updateAddress(addr.id, { ...addr, defaultAddress: true });
      toast('Đã đặt làm địa chỉ mặc định', 'success');
      loadAddresses();
    } catch (err) {
      toast(err.message || 'Thất bại', 'error');
    }
  };

  /* ─── Loading state ─── */
  if (profileLoading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="spinner" />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Đang tải thông tin...
          </p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const initials = getInitials(profile.fullName);
  const isAdmin = profile.role === 'ADMIN';

  return (
    <div className="profile-page">
      <div className="profile-page__inner">

        {/* ─── Header card ─── */}
        <div className="profile-header animate-fadeInUp">
          <div className="profile-header__avatar">{initials}</div>
          <div className="profile-header__info">
            <h1>{profile.fullName}</h1>
            <span className={`profile-header__role ${isAdmin ? 'profile-header__role--admin' : 'profile-header__role--customer'}`}>
              {isAdmin ? '🛠️ Quản trị viên' : '👤 Khách hàng'}
            </span>
          </div>
        </div>

        {/* ─── A. Thông tin tài khoản ─── */}
        <div className="profile-section delay-1">
          <div className="profile-section__header">
            <div className="profile-section__title">
              <span className="profile-section__title-icon">👤</span>
              Thông tin tài khoản
            </div>
          </div>
          <div className="profile-section__body">
            <form className="profile-form" onSubmit={handleInfoSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="profile-email">Email</label>
                <input
                  id="profile-email"
                  type="email"
                  className="form-input"
                  value={profile.email}
                  readOnly
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="profile-form__row">
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-fullName">Họ và tên *</label>
                  <input
                    id="profile-fullName"
                    type="text"
                    className="form-input"
                    value={infoForm.fullName}
                    onChange={e => setInfoForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="Nhập họ và tên"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-phone">Số điện thoại</label>
                  <input
                    id="profile-phone"
                    type="tel"
                    className="form-input"
                    value={infoForm.phone}
                    onChange={e => setInfoForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0912 345 678"
                  />
                </div>
              </div>

              <div className="profile-form__actions">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  id="save-profile-btn"
                  disabled={infoSaving}
                >
                  {infoSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ─── B. Đổi mật khẩu ─── */}
        <div className="profile-section delay-2">
          <div className="profile-section__header">
            <div className="profile-section__title">
              <span className="profile-section__title-icon">🔒</span>
              Đổi mật khẩu
            </div>
          </div>
          <div className="profile-section__body">
            <form className="profile-form" onSubmit={handlePwSubmit}>
              {/* Mật khẩu hiện tại */}
              <div className="form-group">
                <label className="form-label" htmlFor="pw-old">Mật khẩu hiện tại *</label>
                <div className="pw-wrapper">
                  <input
                    id="pw-old"
                    type={pwShow.old ? 'text' : 'password'}
                    className="form-input"
                    value={pwForm.oldPassword}
                    onChange={e => setPwForm(p => ({ ...p, oldPassword: e.target.value }))}
                    placeholder="Nhập mật khẩu hiện tại"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="pw-toggle"
                    onClick={() => setPwShow(p => ({ ...p, old: !p.old }))}
                    aria-label="Hiện/ẩn mật khẩu"
                  >
                    <IconEye show={pwShow.old} />
                  </button>
                </div>
              </div>

              <div className="profile-form__row">
                {/* Mật khẩu mới */}
                <div className="form-group">
                  <label className="form-label" htmlFor="pw-new">Mật khẩu mới *</label>
                  <div className="pw-wrapper">
                    <input
                      id="pw-new"
                      type={pwShow.new ? 'text' : 'password'}
                      className="form-input"
                      value={pwForm.newPassword}
                      onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                      placeholder="Tối thiểu 8 ký tự"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setPwShow(p => ({ ...p, new: !p.new }))}
                      aria-label="Hiện/ẩn mật khẩu mới"
                    >
                      <IconEye show={pwShow.new} />
                    </button>
                  </div>
                </div>

                {/* Xác nhận mật khẩu */}
                <div className="form-group">
                  <label className="form-label" htmlFor="pw-confirm">Xác nhận mật khẩu mới *</label>
                  <div className="pw-wrapper">
                    <input
                      id="pw-confirm"
                      type={pwShow.confirm ? 'text' : 'password'}
                      className={`form-input ${pwForm.confirmPassword && pwForm.confirmPassword !== pwForm.newPassword ? 'error' : ''}`}
                      value={pwForm.confirmPassword}
                      onChange={e => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="pw-toggle"
                      onClick={() => setPwShow(p => ({ ...p, confirm: !p.confirm }))}
                      aria-label="Hiện/ẩn xác nhận mật khẩu"
                    >
                      <IconEye show={pwShow.confirm} />
                    </button>
                  </div>
                  {pwForm.confirmPassword && pwForm.confirmPassword !== pwForm.newPassword && (
                    <span className="form-error">Mật khẩu xác nhận không khớp</span>
                  )}
                </div>
              </div>

              {/* Validation hint */}
              {pwForm.newPassword && pwForm.newPassword.length < 8 && (
                <span className="form-error" style={{ marginTop: '-8px' }}>
                  Mật khẩu mới phải có ít nhất 8 ký tự
                </span>
              )}

              <div className="profile-form__actions">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  id="change-password-btn"
                  disabled={pwSaving}
                >
                  {pwSaving ? 'Đang xử lý...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ─── C. Địa chỉ giao hàng ─── */}
        <div className="profile-section delay-3">
          <div className="profile-section__header">
            <div className="profile-section__title">
              <span className="profile-section__title-icon">📍</span>
              Địa chỉ giao hàng
            </div>
            <button
              className="btn btn-ghost btn-sm"
              id="add-address-btn"
              onClick={() => setAddrModal('new')}
              style={{ gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Thêm địa chỉ
            </button>
          </div>
          <div className="profile-section__body">
            {addrLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div className="spinner" />
              </div>
            ) : addresses.length === 0 ? (
              <div className="address-empty">
                <div className="address-empty__icon">📭</div>
                <p>Bạn chưa có địa chỉ giao hàng nào</p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAddrModal('new')}
                >
                  Thêm địa chỉ đầu tiên
                </button>
              </div>
            ) : (
              <div className="address-list">
                {addresses.map(addr => (
                  <div
                    key={addr.id}
                    className={`address-card ${addr.defaultAddress ? 'address-card--default' : ''}`}
                  >
                    <div className="address-card__info">
                      <div className="address-card__receiver">
                        <span className="address-card__name">{addr.receiverName}</span>
                        <span className="address-card__phone">· {addr.phone}</span>
                        {addr.defaultAddress && (
                          <span className="address-card__badge-default">⭐ Mặc định</span>
                        )}
                      </div>
                      <div className="address-card__detail">{formatAddress(addr)}</div>
                    </div>
                    <div className="address-card__actions">
                      {!addr.defaultAddress && (
                        <button
                          className="address-card__btn address-card__btn--default"
                          onClick={() => handleSetDefault(addr)}
                          title="Đặt làm mặc định"
                        >
                          ⭐ Mặc định
                        </button>
                      )}
                      <button
                        className="address-card__btn address-card__btn--edit"
                        onClick={() => setAddrModal(addr)}
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        className="address-card__btn address-card__btn--delete"
                        onClick={() => handleAddrDelete(addr.id)}
                        disabled={addrDeleting === addr.id}
                      >
                        {addrDeleting === addr.id ? '...' : '🗑️ Xóa'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ─── Address Modal ─── */}
      {addrModal !== null && (
        <AddressModal
          address={addrModal === 'new' ? null : addrModal}
          onClose={() => setAddrModal(null)}
          onSave={handleAddrSave}
        />
      )}
    </div>
  );
}
