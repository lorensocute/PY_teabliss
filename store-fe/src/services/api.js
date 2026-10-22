const API_BASE_URL = 'http://127.0.0.1:8000/api';

async function request(endpoint, options = {}) {
    const token = localStorage.getItem('access');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    let json = null;

    try {
        json = await res.json();
    } catch {
        // Response có thể không có nội dung.
    }

    if (!res.ok || json?.success === false) {
        const errors = json && typeof json === 'object'
            ? Object.entries(json)
                .map(([field, value]) => {
                    const message = Array.isArray(value)
                        ? value.join(' ')
                        : typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value);

                    return `${field}: ${message}`;
                })
                .join('\n')
            : '';

        throw new Error(
            json?.detail ||
            json?.message ||
            errors ||
            `Có lỗi xảy ra (${res.status})`
        );
    }

    return json?.data !== undefined ? json.data : json;
}

function queryString(params = {}) {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(
            ([, value]) =>
                value !== undefined &&
                value !== null &&
                value !== ''
        )
    );

    const query = new URLSearchParams(cleanParams).toString();
    return query ? `?${query}` : '';
}

export const api = {
    // AUTH

    login: async (email, password) => {
        const data = await request('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (data?.access) {
            localStorage.setItem('access', data.access);
        }

        if (data?.refresh) {
            localStorage.setItem('refresh', data.refresh);
        }

        return data;
    },

    register: (data) =>
        request('/auth/register/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    logout: async () => {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return null;
    },

    // PROFILE

    getProfile: () =>
        request('/profile/'),

    updateProfile: (data) =>
        request('/profile/', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    changePassword: (data) =>
        request('/profile/password/', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    // ADDRESS

    getAddresses: () =>
        request('/profile/addresses/'),

    createAddress: (data) =>
        request('/profile/addresses/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateAddress: (id, data) =>
        request(`/profile/addresses/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deleteAddress: (id) =>
        request(`/profile/addresses/${id}/`, {
            method: 'DELETE',
        }),

    // CATEGORY

    getCategories: (params = {}) =>
        request(`/categories/${queryString(params)}`),

    getCategoryById: (id) =>
        request(`/categories/${id}/`),

    createCategory: (data) =>
        request('/categories/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateCategory: (id, data) =>
        request(`/categories/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deactivateCategory: (id) =>
        request(`/categories/${id}/status/`, {
            method: 'PATCH',
        }),

    deleteCategory: (id) =>
        request(`/categories/${id}/status/`, {
            method: 'PATCH',
        }),

    // PRODUCT

    getProducts: (params = {}) =>
        request(`/products/${queryString(params)}`),

    searchProducts: (params = {}) =>
        request(`/products/search/${queryString(params)}`),

    getProductById: (id) =>
        request(`/products/${id}/`),

    createProduct: (data) =>
        request('/products/', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    updateProduct: (id, data) =>
        request(`/products/${id}/`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deactivateProduct: (id) =>
        request(`/products/${id}/status/`, {
            method: 'PATCH',
        }),

    deleteProduct: (id) =>
        request(`/products/${id}/status/`, {
            method: 'PATCH',
        }),

    // CART

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
            { method: 'PUT' }
        ),

    removeFromCart: (itemId) =>
        request(`/cart/items/${itemId}`, {
            method: 'DELETE',
        }),

    clearCart: () =>
        request('/cart', {
            method: 'DELETE',
        }),

    // ORDER - CUSTOMER

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

    // PROMOTION

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

    // ADMIN - USERS

    getAdminUsers: () =>
        request('/admin/users'),

    getAdminUserById: (id) =>
        request(`/admin/users/${id}`),

    toggleUserStatus: (id) =>
        request(`/admin/users/${id}/status`, {
            method: 'PATCH',
        }),

    // ADMIN - ORDERS

    getAdminOrders: () =>
        request('/admin/orders'),

    updateOrderStatus: (id, status) =>
        request(`/admin/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        }),

    // ADMIN - STATISTICS

    getAdminStats: () =>
        request('/admin/statistics/overview'),

    getOrderStats: () =>
        request('/admin/statistics/orders'),

    getProductStats: () =>
        request('/admin/statistics/products'),

    getRevenueStats: (from, to) =>
        request(
            `/admin/statistics/revenue${queryString({
                from: from || undefined,
                to: to || undefined,
            })}`
        ),
};
