import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useActiveFactory } from '../../../../../shared/hooks/useActiveFactory';

/**
 * Context wrapper around `useActiveFactory()`. The hook stays the single
 * source of truth for factory selection; the provider only makes its return
 * value reachable via `useActiveFactoryContext()` so consumers (sidebar,
 * overlays, transcript empty-state, composer) don't need it prop-drilled.
 */

export type ActiveFactoryApi = ReturnType<typeof useActiveFactory>;

const ActiveFactoryContext = createContext<ActiveFactoryApi | null>(null);

export function ActiveFactoryProvider({ children }: { children: ReactNode }) {
  const value = useActiveFactory();
  return <ActiveFactoryContext.Provider value={value}>{children}</ActiveFactoryContext.Provider>;
}

export function useActiveFactoryContext(): ActiveFactoryApi {
  const ctx = useContext(ActiveFactoryContext);
  if (!ctx) throw new Error('useActiveFactoryContext must be used within an ActiveFactoryProvider');
  return ctx;
}
