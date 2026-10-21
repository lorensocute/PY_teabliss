import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from '../components/Toast';

const CartContext = createContext(null);
import { getProductImage } from '../utils/imageHelper';

// Global product cache to enrich cart items with imageUrl
let productsCache = null;

async function getProductMap() {
  if (!productsCache) {
    try {
      const list = await api.getProducts();
      if (Array.isArray(list)) {
        productsCache = {};
        for (const p of list) {
          productsCache[p.id] = p;
        }
      }
    } catch {
      // Ignore cache failure
    }
  }
  return productsCache || {};
}

/**
 * Map CartItemResponse từ backend → state item.
 * Preserve đầy đủ: size, sweetness, ice, toppings từ backend response.
 */
function mapCartItem(item, productMap = {}) {
  const prod = productMap[item.productId] || {};
  const name = item.productName || prod.name || 'Sản phẩm';
  // Use helper to resolve image from either product map or item
  const image = getProductImage({ ...prod, ...item, name });
  const unitPrice = Number(item.price ?? prod.price ?? 0);
  const qty = Number(item.quantity ?? 1);
  const lineTotal = Number(item.lineTotal ?? unitPrice * qty);

  return {
    id: item.id,
    itemId: item.id,
    itemKey: item.id,
    productId: item.productId,
    productName: name,
    price: unitPrice,
    unitPrice: unitPrice,
    quantity: qty,
    lineTotal: lineTotal,
    imageUrl: image,
    // Options từ backend — preserve as-is
    size: item.size ?? null,
    sweetness: item.sweetness ?? null, // null nếu không có; 0 là hợp lệ (Không ngọt)
    ice: item.ice ?? null,
    toppings: Array.isArray(item.toppings) ? item.toppings : [],
    product: {
      id: item.productId,
      name: name,
      price: unitPrice,
      image: image,
      imageUrl: image,
    },
  };
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [cartId, setCartId] = useState(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const resetCart = useCallback(() => {
    setItems([]);
    setCartId(null);
    setTotalPrice(0);
  }, []);

  // Sync state từ backend CartResponse { cartId, items, total }
  const syncCartState = useCallback(async (cartData) => {
    if (!cartData || !Array.isArray(cartData.items)) {
      resetCart();
      return;
    }

    const productMap = await getProductMap();
    const mapped = cartData.items.map((i) => mapCartItem(i, productMap));
    setItems(mapped);
    setCartId(cartData.cartId ?? null);
    setTotalPrice(Number(cartData.total ?? 0));
  }, [resetCart]);

  const fetchCart = useCallback(async () => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      resetCart();
      return;
    }

    setLoading(true);
    try {
      const data = await api.getCart();
      await syncCartState(data);
    } catch {
      resetCart();
    } finally {
      setLoading(false);
    }
  }, [resetCart, syncCartState]);

  useEffect(() => {
    try { localStorage.removeItem('teabliss-cart'); } catch { /* ignore */ }
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    const handleAuthChange = () => {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) {
        resetCart();
      } else {
        fetchCart();
      }
    };

    window.addEventListener('userChanged', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener('userChanged', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [fetchCart, resetCart]);

  /**
   * Thêm sản phẩm vào giỏ hàng.
   *
   * Signature: addItem(product, quantity, options)
   * options = { size, sweetness, ice, toppings }
   *
   * QUAN TRỌNG: sweetness = 0 là hợp lệ (Không ngọt).
   * Không validate bằng !sweetness.
   *
   * size: 'M' | 'L' | 'XL'
   * sweetness: 0 | 30 | 50 | 70 | 100
   * ice: 'HOT' | 'LESS_ICE' | 'NORMAL_ICE' | 'FULL_ICE'
   * toppings: [{ id, name, price }]
   */
  const addItem = async (product, quantity = 1, options = {}) => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      toast('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng', 'warning');
      navigate('/login');
      return false;
    }

    const qty = typeof quantity === 'number' && quantity >= 1 ? quantity : 1;
    const productId = product?.id != null ? Number(product.id) : Number(product);

    if (!productId || qty < 1) return false;

    // Build request payload — backend tính giá
    const payload = {
      productId,
      quantity: qty,
      size: options.size ?? 'M',
      // sweetness: không dùng !sweetness. null/undefined → default 70
      sweetness: options.sweetness !== undefined && options.sweetness !== null
        ? options.sweetness
        : 70,
      ice: options.ice ?? 'NORMAL_ICE',
      toppings: Array.isArray(options.toppings)
        ? options.toppings.map(t => ({ id: t.id, name: t.name, price: t.price }))
        : [],
    };

    try {
      const res = await api.addToCart(payload);
      await syncCartState(res);
      return true;
    } catch (err) {
      if (err.message?.includes('401') || err.message?.toLowerCase().includes('đăng nhập')) {
        toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'warning');
        resetCart();
        navigate('/login');
      } else {
        toast(err.message || 'Không thể thêm vào giỏ hàng', 'error');
      }
      return false;
    }
  };

  const updateQuantity = async (itemIdOrKey, newQuantity) => {
    if (newQuantity < 1) return false;
    const itemId = Number(itemIdOrKey);
    if (!itemId) return false;

    try {
      const res = await api.updateCartItem(itemId, newQuantity);
      await syncCartState(res);
      return true;
    } catch (err) {
      toast(err.message || 'Không thể cập nhật số lượng', 'error');
      await fetchCart();
      return false;
    }
  };

  const removeItem = async (itemIdOrKey) => {
    const itemId = Number(itemIdOrKey);
    if (!itemId) return false;

    try {
      const res = await api.removeFromCart(itemId);
      await syncCartState(res);
      return true;
    } catch (err) {
      toast(err.message || 'Không thể xóa sản phẩm', 'error');
      await fetchCart();
      return false;
    }
  };

  const clearCart = async () => {
    try {
      await api.clearCart();
      resetCart();
      return true;
    } catch (err) {
      toast(err.message || 'Không thể xóa giỏ hàng', 'error');
      await fetchCart();
      return false;
    }
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        cartId,
        totalItems,
        totalPrice,
        loading,
        fetchCart,
        loadCart: fetchCart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        resetCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
