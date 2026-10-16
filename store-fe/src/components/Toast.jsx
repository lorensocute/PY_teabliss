import { useState, useEffect, useCallback } from 'react';
import './Toast.css';

let toastId = 0;
let addToastGlobal = null;

export function toast(message, type = 'info', duration = 3000) {
  if (addToastGlobal) addToastGlobal(message, type, duration);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type, duration) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type, removing: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, removing: true } : t));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
    }, duration);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type} ${t.removing ? 'removing' : ''}`}>
          <span className="toast__icon">{icons[t.type] || 'ℹ️'}</span>
          <span className="toast__message">{t.message}</span>
          <button
            className="toast__close"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
