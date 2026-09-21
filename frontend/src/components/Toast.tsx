import React, { createContext, useContext, useState, useCallback } from 'react';
import { Check, AlertCircle, X } from './Icons';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <Check size={18} color="var(--success)" />}
            {toast.type === 'danger' && <AlertCircle size={18} color="var(--danger)" />}
            {toast.type === 'warning' && <AlertCircle size={18} color="var(--warning)" />}
            {toast.type === 'info' && <AlertCircle size={18} color="var(--primary)" />}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => removeToast(toast.id)}
              style={{ padding: '2px 4px', minHeight: 'auto' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
