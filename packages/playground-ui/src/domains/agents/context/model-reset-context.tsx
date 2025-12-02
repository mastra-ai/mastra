import { createContext, ReactNode, useContext, useRef, useCallback } from 'react';

type ModelResetContextType = {
  registerResetFn: (fn: (() => void) | null) => void;
  triggerReset: () => void;
};

const ModelResetContext = createContext<ModelResetContextType | null>(null);

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
