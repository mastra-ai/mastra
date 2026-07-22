import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useActiveFactory } from '../../../../../shared/hooks/useActiveFactory';

/**
 * Context wrapper around `useActiveFactory(factoryId)`. The route param is the
 * single source of truth for which factory is active; the provider only makes
 * the hook's return value reachable via `useActiveFactoryContext()` so
 * consumers (sidebar, overlays, transcript empty-state, composer) don't need
 * it prop-drilled.
 */

export type ActiveFactoryApi = ReturnType<typeof useActiveFactory>;

const ActiveFactoryContext = createContext<ActiveFactoryApi | null>(null);

export function ActiveFactoryProvider({ factoryId, children }: { factoryId: string; children: ReactNode }) {
  const value = useActiveFactory(factoryId);
  return <ActiveFactoryContext.Provider value={value}>{children}</ActiveFactoryContext.Provider>;
}

export function useActiveFactoryContext(): ActiveFactoryApi {
  const ctx = useContext(ActiveFactoryContext);
  if (!ctx) throw new Error('useActiveFactoryContext must be used within an ActiveFactoryProvider');
  return ctx;
}
