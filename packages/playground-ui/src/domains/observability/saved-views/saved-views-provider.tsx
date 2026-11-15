import type { ReactNode } from 'react';
import { SavedViewsContext } from './saved-views-source';
import type { SavedViewRecord, SavedViewsSource } from './saved-views-source';

export type SavedViewsProviderProps = {
  source: SavedViewsSource;
  /** Keeps the cached views of one scope (e.g. `['project', projectId]`) apart from another's. */
  queryKeyScope?: readonly unknown[];
  /**
   * Whether a view can be renamed, deleted or overwritten here, e.g. `view => view.scope !== 'org'` where
   * org-wide views are read-only. Read-only views can still be applied and duplicated. Defaults to all.
   */
  canEdit?: (view: SavedViewRecord) => boolean;
  /**
   * Whether new views can be saved here (save as new view, duplicate), e.g. `false` for a user who may only
   * read views. With `canEdit={() => false}` the views can only be applied. Defaults to true.
   */
  canCreate?: boolean;
  children: ReactNode;
};

/** Turns saved views on for the observability pages below it. Without it, the pages show none. */
export function SavedViewsProvider({
  source,
  queryKeyScope = [],
  canEdit,
  canCreate,
  children,
}: SavedViewsProviderProps) {
  return (
    <SavedViewsContext.Provider value={{ source, queryKeyScope, canEdit, canCreate }}>
      {children}
    </SavedViewsContext.Provider>
  );
}
