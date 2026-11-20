import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext({
  notify: () => {},
});

let toastCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, type = 'success') => {
      if (!message) return;
      const id = ++toastCounter;
      setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const Icon = t.type === 'error' ? AlertCircle : t.type === 'info' ? Info : CheckCircle2;
          const tone =
            t.type === 'error'
              ? 'border-[#DFC2B8] bg-[#FBF1EE] text-[#7D3628]'
              : t.type === 'info'
                ? 'border-[var(--sl-border-strong)] bg-white text-[var(--sl-text)]'
                : 'border-[#C5D4C3] bg-white text-[var(--sl-text)]';
          const iconColor =
            t.type === 'error'
              ? 'text-[#A65242]'
              : t.type === 'info'
                ? 'text-[#77786F]'
                : 'text-[#526B50]';

          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto sl-animate-in flex items-start gap-2.5 px-3.5 py-3 rounded-md border shadow-sm text-sm ${tone}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
              <p className="flex-1 leading-snug text-[13px]">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="p-0.5 text-[var(--sl-muted)] hover:text-[var(--sl-text)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
