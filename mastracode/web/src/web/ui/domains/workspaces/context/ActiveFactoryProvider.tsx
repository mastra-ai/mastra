import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';

import { useActiveFactory } from '../../../../../shared/hooks/useActiveFactory';

/**
 * Context wrapper around `useActiveFactory()`. The hook resolves the active
 * factory from the `/factories/:factoryId` URL param; the provider only makes
 * its return value reachable via `useActiveFactoryContext()` so consumers
 * (sidebar, overlays, transcript empty-state, composer) don't need it
 * prop-drilled.
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

/**
 * Route layout for `/factories/:factoryId`: mounts the provider so every
 * factory-scoped route reads the same resolved factory, and redirects to `/`
 * when the param doesn't match any factory once the list has hydrated
 * (RootLanding then re-picks a valid factory or onboarding kicks in).
 */
export function ActiveFactoryLayout() {
  return (
    <ActiveFactoryProvider>
      <FactoryParamGuard>
        <Outlet />
      </FactoryParamGuard>
    </ActiveFactoryProvider>
  );
}

function FactoryParamGuard({ children }: { children: ReactNode }) {
  const { activeFactory, factoriesPending } = useActiveFactoryContext();
  if (!factoriesPending && !activeFactory) return <Navigate to="/" replace />;
  return children;
}
