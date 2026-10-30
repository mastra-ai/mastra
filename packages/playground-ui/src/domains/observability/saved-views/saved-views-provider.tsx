import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { SavedViewsContext } from './saved-views-source';
import type { SavedViewsSource } from './saved-views-source';

export type SavedViewsProviderProps = {
  source: SavedViewsSource;
  /** Keeps the cached views of one scope (e.g. `['project', projectId]`) apart from another's. */
  queryKeyScope?: readonly unknown[];
  children: ReactNode;
};

/** Turns saved views on for the observability pages below it. Without it, the pages show none. */
export function SavedViewsProvider({ source, queryKeyScope = [], children }: SavedViewsProviderProps) {
  const scopeKey = JSON.stringify(queryKeyScope);
  // The scope is compared by value, so a host can pass a fresh array on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ source, queryKeyScope }), [source, scopeKey]);
  return <SavedViewsContext.Provider value={value}>{children}</SavedViewsContext.Provider>;
}
