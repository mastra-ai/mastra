import { createContext, ReactNode, useContext, useRef, useCallback } from 'react';

type ModelResetContextType = {
  registerResetFn: (fn: (() => void) | null) => void;
  triggerReset: () => void;
};

const ModelResetContext = createContext<ModelResetContextType | null>(null);

export function ModelResetProvider({ children }: { children: ReactNode }) {
  const resetFnRef = useRef<(() => void) | null>(null);

  const registerResetFn = useCallback((fn: (() => void) | null) => {
    resetFnRef.current = fn;
  }, []);

  const triggerReset = useCallback(() => {
    if (resetFnRef.current) {
      resetFnRef.current();
    }
  }, []);

  return <ModelResetContext.Provider value={{ registerResetFn, triggerReset }}>{children}</ModelResetContext.Provider>;
}

export function useModelReset() {
  const context = useContext(ModelResetContext);
  // Return a no-op implementation if context is not available
  if (!context) {
    return {
      registerResetFn: () => {},
      triggerReset: () => {},
    };
  }
  return context;
}
