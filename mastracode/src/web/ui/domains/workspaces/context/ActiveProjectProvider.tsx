import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useActiveProject } from '../hooks/useActiveProject';

/**
 * Context wrapper around `useActiveProject()`. The hook stays the single
 * source of truth for project selection; the provider only makes its return
 * value reachable via `useActiveProjectContext()` so consumers (sidebar,
 * overlays, transcript empty-state, composer) don't need it prop-drilled.
 */

export type ActiveProjectApi = ReturnType<typeof useActiveProject>;

const ActiveProjectContext = createContext<ActiveProjectApi | null>(null);

export function ActiveProjectProvider({ children }: { children: ReactNode }) {
  const value = useActiveProject();
  return <ActiveProjectContext.Provider value={value}>{children}</ActiveProjectContext.Provider>;
}

export function useActiveProjectContext(): ActiveProjectApi {
  const ctx = useContext(ActiveProjectContext);
  if (!ctx) throw new Error('useActiveProjectContext must be used within an ActiveProjectProvider');
  return ctx;
}
