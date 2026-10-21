import { localStorageSavedViewsBackend, useSavedViews } from '@mastra/playground-ui/components/SavedViews';
import type { SavedViewsController } from '@mastra/playground-ui/components/SavedViews';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { SetURLSearchParams } from 'react-router';

import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  clearOpenCard,
} from '../boardFilters';
import type { BoardFilterState } from '../boardFilters';
import { boardLayoutFromParams, boardLayoutParams } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';
import type { BoardSort } from '../boardOrder';
import { withPeopleFolded, withPeopleUnfolded } from '../boardPeople';
import type { PersonIdentity } from '../boardPeople';
import { BOARD_VIEW_QUERY, boardViewStateSchema, savedBoardViewsStorageKey } from '../boardSavedViews';
import type { BoardViewState } from '../boardSavedViews';
import { boardSortFromParams, boardSortParams, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardKind } from '../boardStages';
import { saveBoardView } from '../services/boardViews';

const BOARD_SEARCH_QUERY = 'search';

/** Unsaved edits to a saved view. They only count while that view stays active. */
type BoardViewDraft = { viewId: string; state: BoardViewState };

export interface BoardView {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  savedViews: SavedViewsController<BoardViewState>;
  filters: BoardFilterState;
  search: string;
  sort: BoardSort;
  layout: BoardLayout;
  setFilters: (next: BoardFilterState) => void;
  clearFilters: () => void;
  setSearch: (next: string) => void;
  setSort: (next: BoardSort) => void;
  setLayout: (next: BoardLayout) => void;
  resetProperties: () => void;
  saveAsView: () => void;
}

export function useBoardView({
  factoryProjectId,
  kind,
  currentUserId,
  personId,
}: {
  factoryProjectId: string;
  kind: BoardKind;
  currentUserId?: string;
  personId: PersonIdentity;
}): BoardView {
  const [searchParams, setSearchParams] = useSearchParams();

  const replaceParams = (params: URLSearchParams) => {
    saveBoardView(factoryProjectId, kind, params);
    setSearchParams(params, { replace: true });
  };

  const activeViewId = searchParams.get(BOARD_VIEW_QUERY) ?? undefined;
  const [pendingDraft, setDraft] = useState<BoardViewDraft>();
  const draft = pendingDraft?.viewId === activeViewId ? pendingDraft : undefined;

  const pageState: BoardViewState = {
    filters: boardFilterItems(boardFiltersFromParams(searchParams, kind)),
    sort: boardSortFromParams(searchParams, currentUserId),
    layout: boardLayoutFromParams(searchParams),
  };

  // Showing a view, or changing which one is active, drops the draft of edits.
  const showView = (viewId: string | undefined) => {
    setDraft(undefined);
    const params = new URLSearchParams(searchParams);
    if (viewId) params.set(BOARD_VIEW_QUERY, viewId);
    else params.delete(BOARD_VIEW_QUERY);
    params.delete(BOARD_SEARCH_QUERY);
    clearOpenCard(params);
    replaceParams(params);
  };

  const savedViews = useSavedViews({
    backend: localStorageSavedViewsBackend(savedBoardViewsStorageKey(factoryProjectId, kind)),
    schema: boardViewStateSchema,
    activeViewId,
    // While a view is active the board shows it, or the draft of edits made to it.
    current: activeViewId ? draft?.state : pageState,
    onApply: view => showView(view?.id),
    onActiveViewChange: showView,
  });

  const { activeView } = savedViews;
  const shown: BoardViewState = draft?.state ?? activeView?.state ?? pageState;
  const storedFilters = boardFilterStateFromItems(shown.filters, kind);
  const filters = withPeopleFolded(storedFilters, personId);
  const sort = shown.sort === 'recent-mine' && !currentUserId ? DEFAULT_BOARD_SORT : shown.sort;
  const editView = (patch: Partial<BoardViewState>) => {
    if (activeView) setDraft({ viewId: activeView.id, state: { ...shown, ...patch } });
  };

  return {
    searchParams,
    setSearchParams,
    savedViews,
    filters,
    search: searchParams.get(BOARD_SEARCH_QUERY) ?? '',
    sort,
    layout: shown.layout,
    setSearch: next => {
      const params = new URLSearchParams(searchParams);
      if (next) params.set(BOARD_SEARCH_QUERY, next);
      else params.delete(BOARD_SEARCH_QUERY);
      clearOpenCard(params);
      setSearchParams(params, { replace: true });
    },
    setFilters: (next: BoardFilterState) => {
      const stored = withPeopleUnfolded(next, personId);
      const params = activeView ? new URLSearchParams(searchParams) : boardFilterParams(searchParams, stored);
      clearOpenCard(params);
      if (activeView) editView({ filters: boardFilterItems(stored) });
      if (params.toString() !== searchParams.toString()) replaceParams(params);
    },
    saveAsView: savedViews.startCreating,
    clearFilters: () => {
      const params = activeView
        ? new URLSearchParams(searchParams)
        : boardFilterParams(searchParams, boardFilterStateFromItems([], kind));
      params.delete(BOARD_SEARCH_QUERY);
      clearOpenCard(params);
      if (activeView) editView({ filters: [] });
      replaceParams(params);
    },
    setSort: (next: BoardSort) => {
      if (activeView) editView({ sort: next });
      else replaceParams(boardSortParams(searchParams, next));
    },
    setLayout: (next: BoardLayout) => {
      if (activeView) editView({ layout: next });
      else replaceParams(boardLayoutParams(searchParams, next));
    },
    resetProperties: () => {
      if (activeView) {
        editView({ filters: [], sort: DEFAULT_BOARD_SORT });
        return;
      }
      const params = boardSortParams(
        boardFilterParams(searchParams, boardFilterStateFromItems([], kind)),
        DEFAULT_BOARD_SORT,
      );
      clearOpenCard(params);
      replaceParams(params);
    },
  };
}
