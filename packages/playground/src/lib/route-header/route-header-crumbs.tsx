import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CrumbsOverrideContext, useRouteHeaderCrumbsSetter } from './route-header-crumbs-context';
import type { CrumbDef } from './types';

/**
 * Wraps the layout subtree so `<RouteHeader/>` (which reads the override) and
 * pages (which set it via `<RouteHeaderCrumbs/>`) share the same state.
 */
export function RouteHeaderCrumbsProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<CrumbDef[] | null>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return <CrumbsOverrideContext.Provider value={value}>{children}</CrumbsOverrideContext.Provider>;
}

/**
 * Page-side override: sets crumbs that take precedence over route-handle
 * crumbs while mounted. Use when crumbs depend on data that handle resolvers
 * can't read (e.g., React Query cache, validated search params).
 * No-op when the layout doesn't render `<RouteHeader/>`.
 */
export function RouteHeaderCrumbs({ crumbs }: { crumbs: CrumbDef[] }) {
  const setOverride = useRouteHeaderCrumbsSetter();

  useEffect(() => {
    if (!setOverride) return;
    setOverride(crumbs);
    return () => setOverride(null);
  }, [crumbs, setOverride]);

  return null;
}
