export const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=500&q=80';

export function createSlug(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD') // Tách dấu
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
    .replace(/đ/g, 'd')
    .replace(/\s+/g, '-') // Đổi khoảng trắng thành -
    .replace(/[^a-z0-9-]/g, '') // Bỏ ký tự đặc biệt
    .replace(/-+/g, '-'); // Tránh 2 dấu - liên tiếp
}

export function getProductImage(product) {
  if (!product) return PLACEHOLDER_IMG;
  
  // 1. Dùng imageUrl có sẵn (ưu tiên 1)
  if (product.imageUrl) return product.imageUrl;
  if (product.productImage) return product.productImage; // Cho CartItem cũ
  if (product.image) return product.image; // Từ mockData
  
  // Xử lý object lồng nhau (vd: item.product)
  if (product.product) {
    if (product.product.imageUrl) return product.product.imageUrl;
    if (product.product.image) return product.product.image;
    if (product.product.name) {
      return `/images/products/${createSlug(product.product.name)}.webp`;
    }
  }

  // 2. Map tên product sang ảnh local
  const name = product.productName || product.name;
  if (name) {
    return `/images/products/${createSlug(name)}.webp`;
  }

  // 3. Fallback placeholder
  return PLACEHOLDER_IMG;
}

export function handleImageError(e) {
  e.target.onerror = null;
  e.target.src = PLACEHOLDER_IMG;
}
