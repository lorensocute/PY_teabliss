import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ToastContainer from './components/Toast';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AuthPage from './pages/AuthPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import OrdersPage from './pages/OrdersPage';


export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route
            path="*"
            element={
              <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="empty-state" style={{ marginTop: '80px' }}>
                  <div className="empty-state__icon">🌊</div>
                  <h2 className="empty-state__title">404 - Trang Không Tìm Thấy</h2>
                  <p className="empty-state__desc">Trang bạn tìm kiếm không tồn tại.</p>
                  <a href="/" className="btn btn-primary">Về Trang Chủ</a>
                </div>
              </div>
            }
          />
        </Routes>
        <Footer />
        <ToastContainer />
      </CartProvider>
    </BrowserRouter>
  );
}