/* Shared, validated cart storage. Keeps the existing storage key and object format. */
(() => {
  const KEY = 'seedshop_cart_v1';
  const MAX_QTY = 100;
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(id);
  const validQty = qty => Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY;

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter(([id, qty]) => validId(id) && validQty(qty)));
    } catch {
      return {};
    }
  }
  function write(cart) {
    try {
      const clean = Object.fromEntries(Object.entries(cart || {}).filter(([id, qty]) => validId(id) && validQty(qty)));
      localStorage.setItem(KEY, JSON.stringify(clean));
      return true;
    } catch {
      return false;
    }
  }
  function add(id, amount = 1) {
    if (!validId(id) || !Number.isInteger(amount) || amount < 1) return false;
    const cart = read();
    cart[id] = Math.min(MAX_QTY, (cart[id] || 0) + amount);
    return write(cart);
  }
  function setQuantity(id, qty) {
    if (!validId(id) || !validQty(qty)) return false;
    const cart = read();
    if (!(id in cart)) return false;
    cart[id] = qty;
    return write(cart);
  }
  function remove(id) {
    if (!validId(id)) return false;
    const cart = read();
    delete cart[id];
    return write(cart);
  }
  window.SeedshopCart = { key: KEY, maxQuantity: MAX_QTY, read, write, add, setQuantity, remove, count: () => Object.values(read()).reduce((sum, qty) => sum + qty, 0) };
})();