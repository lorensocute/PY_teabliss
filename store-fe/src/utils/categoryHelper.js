/**
 * Helper chuẩn hóa tên và mô tả hiển thị cho các danh mục đồ uống TeaBliss.
 * Đảm bảo hiển thị tiếng Việt có dấu đầy đủ (Trà Sữa, Trà Trái Cây, Cà Phê, Matcha).
 * Giữ nguyên tên và mô tả đối với các danh mục mới do Admin tạo.
 */

const KNOWN_CATEGORIES = {
  'tra-sua': {
    name: 'Trà Sữa',
    icon: '🧋',
    desc: 'Các loại trà sữa thơm béo kết hợp cùng nhiều loại topping hấp dẫn.',
  },
  'tra-trai-cay': {
    name: 'Trà Trái Cây',
    icon: '🍹',
    desc: 'Trà thanh mát kết hợp trái cây tươi và hương vị nhiệt đới.',
  },
  'ca-phe': {
    name: 'Cà Phê',
    icon: '☕',
    desc: 'Các món cà phê đậm vị dành cho người yêu hương thơm cà phê.',
  },
  'matcha': {
    name: 'Matcha',
    icon: '🍵',
    desc: 'Các thức uống từ matcha với vị trà xanh thanh khiết đặc trưng chuẩn Nhật.',
  },
};

/**
 * Phân tích key danh mục dựa trên chuỗi tên (bỏ dấu)
 */
function resolveKnownKey(str) {
  if (!str || typeof str !== 'string') return null;
  const norm = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

  if (norm === 'tra sua' || norm === 'tra-sua' || norm.startsWith('tra sua')) {
    return 'tra-sua';
  }
  if (norm === 'tra trai cay' || norm === 'tra-trai-cay' || norm.startsWith('tra trai cay')) {
    return 'tra-trai-cay';
  }
  if (norm === 'ca phe' || norm === 'ca-phe' || norm === 'coffee' || norm.startsWith('ca phe')) {
    return 'ca-phe';
  }
  if (norm === 'matcha' || norm.startsWith('matcha')) {
    return 'matcha';
  }
  return null;
}

/**
 * Chuẩn hóa tên danh mục hiển thị (vd: 'Tra Sua' -> 'Trà Sữa')
 * Nếu là danh mục tùy chỉnh mới của Admin, giữ nguyên tên gốc.
 */
export function formatCategoryName(catOrName) {
  if (!catOrName) return '';
  const isObj = typeof catOrName === 'object' && catOrName !== null;
  const rawName = isObj ? catOrName.name : catOrName;
  if (!rawName || typeof rawName !== 'string') return '';

  const key = resolveKnownKey(rawName);
  if (key && KNOWN_CATEGORIES[key]) {
    return KNOWN_CATEGORIES[key].name;
  }
  return rawName;
}

/**
 * Chuẩn hóa mô tả danh mục hiển thị (vd: 'Danh muc tra sua' -> tiếng Việt chuẩn dấu)
 * Nếu Admin nhập mô tả tùy chỉnh, giữ nguyên mô tả gốc.
 */
export function formatCategoryDescription(catOrDesc, rawNameFallback) {
  const isObj = typeof catOrDesc === 'object' && catOrDesc !== null;
  const rawDesc = isObj ? catOrDesc.description : (typeof catOrDesc === 'string' ? catOrDesc : '');
  const name = isObj ? (catOrDesc.name || rawNameFallback) : rawNameFallback;

  const key = resolveKnownKey(name);
  if (key && KNOWN_CATEGORIES[key]) {
    // Chuỗi mô tả cũ thiếu dấu từ seed ban đầu
    const descNorm = (rawDesc || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();

    if (!rawDesc || descNorm === 'danh muc tra sua' || descNorm === 'danh muc tra trai cay da cap nhat') {
      return KNOWN_CATEGORIES[key].desc;
    }
  }
  return rawDesc || (key && KNOWN_CATEGORIES[key]?.desc) || '';
}

/**
 * Lấy metadata hiển thị trọn gói (name, icon, desc)
 */
export function getCategoryDisplay(cat) {
  if (!cat) {
    return { name: '', icon: '🧋', desc: '' };
  }
  const rawName = cat.name || '';
  const key = resolveKnownKey(rawName);

  if (key && KNOWN_CATEGORIES[key]) {
    const known = KNOWN_CATEGORIES[key];
    return {
      name: known.name,
      icon: known.icon,
      desc: formatCategoryDescription(cat.description, rawName),
    };
  }

  return {
    name: rawName,
    icon: '🍵',
    desc: cat.description || '',
  };
}

/**
 * Chuẩn hóa tên sản phẩm hiển thị nếu bị thiếu dấu từ seed ban đầu (ví dụ: Tra Sua Tran Chau).
 * Giữ nguyên tuyệt đối tên sản phẩm tùy chỉnh do Admin tạo.
 */
export function formatProductName(name) {
  if (!name || typeof name !== 'string') return '';
  const norm = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

  if (norm === 'tra sua tran chau') {
    return 'Trà Sữa Trân Châu';
  }
  return name;
}
