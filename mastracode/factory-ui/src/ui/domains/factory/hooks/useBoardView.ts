import { useSavedViews } from '@mastra/playground-ui/components/SavedViews';
import type { SavedViewsController } from '@mastra/playground-ui/components/SavedViews';
import { useLayoutEffect } from 'react';
import { useSearchParams } from 'react-router';
import type { SetURLSearchParams } from 'react-router';

import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
} from '../boardFilters';
import type { BoardFilterState } from '../boardFilters';
import { DEFAULT_BOARD_LAYOUT } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';
import type { BoardSort } from '../boardOrder';
import { BOARD_VIEW_QUERY, boardViewSettingsSchema, savedBoardViewsStorageKey } from '../boardSavedViews';
import type { BoardViewSettings } from '../boardSavedViews';
import { boardSortFromParams, boardSortParams, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardKind } from '../boardStages';
import { restoreBoardView, saveBoardView } from '../services/boardViews';

/** The open card and the comment it deep-links to are one selection: clear them together. */
export function clearOpenCard(params: URLSearchParams) {
  params.delete('item');
  params.delete('comment');
}

export interface BoardView {
  /** The URL with any remembered board view filled in; read the open card from here. */
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  savedViews: SavedViewsController<BoardViewSettings>;
  filters: BoardFilterState;
  sort: BoardSort;
  layout: BoardLayout;
  newViewSettings: BoardViewSettings;
  setFilters: (next: BoardFilterState) => void;
  setSort: (next: BoardSort) => void;
  setLayout: (next: BoardLayout) => void;
}

/**
 * What the board shows and how: filters, sort and layout. Without a saved view, filters and sort
 * live in the URL and the layout is the board; with one, they come from the view (or its open
 * draft) and every change edits that draft.
 */
export function useBoardView({
  factoryProjectId,
  kind,
  currentUserId,
}: {
  factoryProjectId: string;
  kind: BoardKind;
  currentUserId?: string;
}): BoardView {
  const [urlParams, setSearchParams] = useSearchParams();
  // Opening a board without filters or sort in the URL (e.g. from the sidebar) brings back the ones
  // last used here. They apply on this render so the board never flashes unfiltered; the effect
  // then writes them into the URL.
  const restoredParams = restoreBoardView(factoryProjectId, kind, urlParams);
  const searchParams = restoredParams ?? urlParams;
  const restoredSearch = restoredParams?.toString();
  useLayoutEffect(() => {
    if (restoredSearch !== undefined) setSearchParams(new URLSearchParams(restoredSearch), { replace: true });
  }, [restoredSearch, setSearchParams]);

  const replaceParams = (params: URLSearchParams) => {
    saveBoardView(factoryProjectId, kind, params);
    setSearchParams(params, { replace: true });
  };

  const savedViews = useSavedViews<BoardViewSettings>({
    storageKey: savedBoardViewsStorageKey(factoryProjectId, kind),
    settingsSchema: boardViewSettingsSchema,
    activeViewId: searchParams.get(BOARD_VIEW_QUERY) ?? undefined,
    onActiveViewChange: viewId => {
      const params = new URLSearchParams(searchParams);
      if (viewId) params.set(BOARD_VIEW_QUERY, viewId);
      else params.delete(BOARD_VIEW_QUERY);
      clearOpenCard(params);
      replaceParams(params);
    },
  });

  const { applied } = savedViews;
  const pageSettings: BoardViewSettings = {
    sort: boardSortFromParams(searchParams, currentUserId),
    layout: DEFAULT_BOARD_LAYOUT,
  };
  const pageFilters = boardFiltersFromParams(searchParams, kind);
  const settings = applied?.settings ?? pageSettings;
  // A view saved by someone signed in can ask for "moved by me"; without a user that means nothing.
  const sort = settings.sort === 'recent-mine' && !currentUserId ? DEFAULT_BOARD_SORT : settings.sort;

  return {
    searchParams,
    setSearchParams,
    savedViews,
    filters: applied ? boardFilterStateFromItems(applied.filters, kind) : pageFilters,
    sort,
    layout: settings.layout,
    newViewSettings: { ...settings, sort },
    setFilters: (next: BoardFilterState) => {
      if (applied) {
        savedViews.change({ filters: boardFilterItems(next, kind) });
        return;
      }
      const params = boardFilterParams(searchParams, next, kind);
      clearOpenCard(params);
      replaceParams(params);
    },
    setSort: (next: BoardSort) => {
      if (applied) savedViews.change({ settings: { ...applied.settings, sort: next } });
      else replaceParams(boardSortParams(searchParams, next));
    },
    setLayout: (next: BoardLayout) => savedViews.change({ settings: { ...settings, layout: next } }),
  };
}
