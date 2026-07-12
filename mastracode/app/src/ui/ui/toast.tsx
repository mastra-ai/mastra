import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

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
  const contextValue = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        className="pointer-events-none fixed bottom-3 right-3 z-80 flex flex-col items-stretch gap-2 sm:bottom-5 sm:right-5 sm:items-end"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-none items-center gap-2 rounded-lg border px-3.5 py-2.5 text-ui-sm font-medium text-icon6 shadow-lg sm:max-w-80 ${
              t.level === 'error' ? 'border-error/45 bg-surface5' : 'border-border2 bg-surface5'
            } before:size-1.5 before:shrink-0 before:rounded-full before:content-[''] ${
              t.level === 'success'
                ? 'before:bg-accent1'
                : t.level === 'error'
                  ? 'before:bg-error'
                  : 'before:bg-accent2'
            }`}
            role="status"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
