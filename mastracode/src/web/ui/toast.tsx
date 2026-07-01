import { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastLevel = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  text: string;
  level: ToastLevel;
}

interface ToastApi {
  /** Show a transient toast. Returns nothing; auto-dismisses. */
  toast: (text: string, level?: ToastLevel) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });

/** Fire transient toasts from anywhere under the provider. */
export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const DISMISS_MS = 2600;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const toast = useCallback((text: string, level: ToastLevel = 'info') => {
    const id = ++seq.current;
    setToasts(t => [...t, { id, text, level }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.level}`} role="status">
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
