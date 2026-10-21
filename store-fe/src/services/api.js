const API_BASE_URL = 'http://localhost:8080/api';

async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,

        // Backend dùng HttpSession.
        // Bắt buộc gửi/nhận cookie JSESSIONID.
        credentials: 'include',
    });

    let json = null;

    try {
        json = await res.json();
    } catch {
        // Trường hợp response không có JSON body
    }

    if (!res.ok || json?.success === false) {
        throw new Error(
            json?.message || `Có lỗi xảy ra (${res.status})`
        );
    }

    return json?.data;
}

export const api = {

    // =====================================================
    // AUTH
    // =====================================================

    login: (email, password) =>
        request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password,
            }),
        }),

    register: (data) =>
        request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    logout: () =>
        request('/auth/logout', {
            method: 'POST',
        }),

    // =====================================================
    // PROFILE
    // =====================================================

    getProfile: () =>
        request('/profile'),

    updateProfile: (data) =>
        request('/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    changePassword: (data) =>
        request('/profile/password', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // =====================================================
    // ADDRESS
    // =====================================================

    getAddresses: () =>
        request('/profile/addresses'),

    createAddress: (data) =>
        request('/profile/addresses', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateAddress: (id, data) =>
        request(`/profile/addresses/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deleteAddress: (id) =>
        request(`/profile/addresses/${id}`, {
            method: 'DELETE',
        }),

    // =====================================================
    // CATEGORY
    // =====================================================

    getCategories: (params = {}) => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null &&
                    value !== ''
            )
        );
        const query = new URLSearchParams(cleanParams).toString();
        return request(`/categories${query ? `?${query}` : ''}`);
    },

    getCategoryById: (id) =>
        request(`/categories/${id}`),

    createCategory: (data) =>
        request('/categories', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateCategory: (id, data) =>
        request(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Backend dùng soft delete / INACTIVE
    deactivateCategory: (id) =>
        request(`/categories/${id}/status`, {
            method: 'PATCH',
        }),

    // Giữ alias để frontend cũ chưa cần sửa ngay
    deleteCategory: (id) =>
        request(`/categories/${id}/status`, {
            method: 'PATCH',
        }),

    // =====================================================
    // PRODUCT
    // =====================================================

    getProducts: (params = {}) => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null &&
                    value !== ''
            )
        );

        const query =
            new URLSearchParams(cleanParams).toString();

        return request(
            `/products${query ? `?${query}` : ''}`
        );
    },

    searchProducts: (params = {}) => {
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null &&
                    value !== ''
            )
        );

        const query =
            new URLSearchParams(cleanParams).toString();

        return request(
            `/products/search${query ? `?${query}` : ''}`
        );
    },

    getProductById: (id) =>
        request(`/products/${id}`),

    createProduct: (data) =>
        request('/products', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateProduct: (id, data) =>
        request(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // Backend dùng soft delete / INACTIVE
    deactivateProduct: (id) =>
        request(`/products/${id}/status`, {
            method: 'PATCH',
        }),

    // Alias cho code frontend cũ
    deleteProduct: (id) =>
        request(`/products/${id}/status`, {
            method: 'PATCH',
        }),

    // =====================================================
    // CART
    // =====================================================

    getCart: () =>
        request('/cart'),

    addToCart: (data) =>
        request('/cart/items', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateCartItem: (itemId, quantity) =>
        request(
            `/cart/items/${itemId}?quantity=${encodeURIComponent(quantity)}`,
            {
                method: 'PUT',
            }
        ),

    removeFromCart: (itemId) =>
        request(`/cart/items/${itemId}`, {
            method: 'DELETE',
        }),

    clearCart: () =>
        request('/cart', {
            method: 'DELETE',
        }),

    // =====================================================
    // ORDER - CUSTOMER
    // =====================================================

    createOrder: (data) =>
        request('/orders', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    getMyOrders: () =>
        request('/orders'),

    getMyOrderById: (id) =>
        request(`/orders/${id}`),

    cancelOrder: (id) =>
        request(`/orders/${id}/cancel`, {
            method: 'PATCH',
        }),

    // =====================================================
    // PROMOTION
    // =====================================================

    getPromotions: () =>
        request('/promotions'),

    getPromotionById: (id) =>
        request(`/promotions/${id}`),

    createPromotion: (data) =>
        request('/promotions', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updatePromotion: (id, data) =>
        request(`/promotions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deactivatePromotion: (id) =>
        request(`/promotions/${id}/status`, {
            method: 'PATCH',
        }),

    // =====================================================
    // ADMIN - USERS
    // =====================================================

    getAdminUsers: () =>
        request('/admin/users'),

    getAdminUserById: (id) =>
        request(`/admin/users/${id}`),

    toggleUserStatus: (id) =>
        request(`/admin/users/${id}/status`, {
            method: 'PATCH',
        }),

    // =====================================================
    // ADMIN - ORDERS
    // =====================================================

    getAdminOrders: () =>
        request('/admin/orders'),

    updateOrderStatus: (id, status) =>
        request(`/admin/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
                status,
            }),
        }),

    // =====================================================
    // ADMIN - STATISTICS
    // =====================================================

    getAdminStats: () =>
        request('/admin/statistics/overview'),

    getOrderStats: () =>
        request('/admin/statistics/orders'),

    getProductStats: () =>
        request('/admin/statistics/products'),

    getRevenueStats: (from, to) => {
        const params = new URLSearchParams();

        if (from) {
            params.append('from', from);
        }

        if (to) {
            params.append('to', to);
        }

        const query = params.toString();

        return request(
            `/admin/statistics/revenue${query ? `?${query}` : ''}`
        );
    },
};