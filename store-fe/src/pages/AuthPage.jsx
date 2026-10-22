import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from '../components/Toast';
import { api } from '../services/api';
import './AuthPage.css';

const IconEye = ({ show }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    {show ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    )}
  </svg>
);

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.pathname !== '/register';

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!isLogin) {
      if (!formData.name.trim()) {
        newErrors.name = 'Vui lòng nhập họ và tên';
      }

      if (!formData.phone.trim()) {
        newErrors.phone = 'Vui lòng nhập số điện thoại';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Email không hợp lệ';
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (!isLogin && formData.password.length < 8) {
      newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    if (!isLogin) {
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
      } else if (formData.confirmPassword !== formData.password) {
        newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!validateForm()) {
      toast('Vui lòng kiểm tra lại thông tin', 'error');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const data = await api.login(
          formData.email.trim(),
          formData.password
        );

        if (!data?.user || !data?.access) {
          throw new Error('Dữ liệu đăng nhập trả về không hợp lệ');
        }

        const user = data.user;

        localStorage.setItem('access', data.access);

        if (data.refresh) {
          localStorage.setItem('refresh', data.refresh);
        } else {
          localStorage.removeItem('refresh');
        }

        localStorage.setItem(
          'user',
          JSON.stringify({
            ...user,
            fullName: user.full_name,
          })
        );

        localStorage.removeItem('token');
        window.dispatchEvent(new Event('userChanged'));

        toast('Đăng nhập thành công!', 'success');

        navigate(user.role === 'ADMIN' ? '/admin' : '/', {
          replace: true,
        });
      } else {
        await api.register({
          full_name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          password: formData.password,
        });

        toast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');

        setFormData((prev) => ({
          name: '',
          phone: '',
          email: prev.email.trim(),
          password: '',
          confirmPassword: '',
        }));

        setErrors({});
        setShowPassword(false);
        setShowConfirmPassword(false);
        navigate('/login', { replace: true });
      }
    } catch (err) {
      toast(
        err.message || 'Có lỗi xảy ra, vui lòng thử lại',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (toLogin) => {
    if (loading) return;

    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);

    setFormData((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
    }));

    navigate(toLogin ? '/login' : '/register', {
      replace: true,
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => switchTab(true)}
            disabled={loading}
          >
            Đăng nhập
          </button>

          <button
            type="button"
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => switchTab(false)}
            disabled={loading}
          >
            Đăng ký
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  Họ và tên
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  autoComplete="name"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nhập họ và tên của bạn"
                  disabled={loading}
                />
                {errors.name && (
                  <span className="form-error">{errors.name}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  autoComplete="tel"
                  maxLength={20}
                  className={`form-input ${errors.phone ? 'error' : ''}`}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Nhập số điện thoại"
                  disabled={loading}
                />
                {errors.phone && (
                  <span className="form-error">{errors.phone}</span>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              value={formData.email}
              onChange={handleChange}
              placeholder="Nhập địa chỉ email"
              disabled={loading}
            />
            {errors.email && (
              <span className="form-error">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Mật khẩu
            </label>
            <div className="pw-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className={`form-input ${errors.password ? 'error' : ''}`}
                value={formData.password}
                onChange={handleChange}
                placeholder="Nhập mật khẩu"
                disabled={loading}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                <IconEye show={showPassword} />
              </button>
            </div>
            {errors.password && (
              <span className="form-error">{errors.password}</span>
            )}
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Xác nhận mật khẩu
              </label>
              <div className="pw-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  className={`form-input ${
                    errors.confirmPassword ? 'error' : ''
                  }`}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={
                    showConfirmPassword
                      ? 'Ẩn xác nhận mật khẩu'
                      : 'Hiện xác nhận mật khẩu'
                  }
                >
                  <IconEye show={showConfirmPassword} />
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="form-error">{errors.confirmPassword}</span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-button"
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
            <button
              type="button"
              onClick={() => switchTab(!isLogin)}
              disabled={loading}
            >
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}