import { useSavedViews } from '@mastra/playground-ui/components/SavedViews';
import type { SavedViewsController } from '@mastra/playground-ui/components/SavedViews';
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
import { DEFAULT_BOARD_LAYOUT } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';
import type { BoardSort } from '../boardOrder';
import { BOARD_VIEW_QUERY, boardViewSettingsSchema, savedBoardViewsStorageKey } from '../boardSavedViews';
import type { BoardViewSettings } from '../boardSavedViews';
import { boardSortFromParams, boardSortParams, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardKind } from '../boardStages';
import { saveBoardView } from '../services/boardViews';

const BOARD_SEARCH_QUERY = 'search';

export interface BoardView {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  savedViews: SavedViewsController<BoardViewSettings>;
  filters: BoardFilterState;
  search: string;
  sort: BoardSort;
  layout: BoardLayout;
  newViewSettings: BoardViewSettings;
  setFilters: (next: BoardFilterState) => void;
  setSearch: (next: string) => void;
  setSort: (next: BoardSort) => void;
  setLayout: (next: BoardLayout) => void;
}

export function useBoardView({
  factoryProjectId,
  kind,
  currentUserId,
}: {
  factoryProjectId: string;
  kind: BoardKind;
  currentUserId?: string;
}): BoardView {
  const [searchParams, setSearchParams] = useSearchParams();

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
      params.delete(BOARD_SEARCH_QUERY);
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
  const sort = settings.sort === 'recent-mine' && !currentUserId ? DEFAULT_BOARD_SORT : settings.sort;

  return {
    searchParams,
    setSearchParams,
    savedViews,
    filters: applied ? boardFilterStateFromItems(applied.filters, kind) : pageFilters,
    search: searchParams.get(BOARD_SEARCH_QUERY) ?? '',
    sort,
    layout: settings.layout,
    newViewSettings: { ...settings, sort },
    setSearch: next => {
      const params = new URLSearchParams(searchParams);
      if (next) params.set(BOARD_SEARCH_QUERY, next);
      else params.delete(BOARD_SEARCH_QUERY);
      clearOpenCard(params);
      setSearchParams(params, { replace: true });
    },
    setFilters: (next: BoardFilterState) => {
      const params = applied ? new URLSearchParams(searchParams) : boardFilterParams(searchParams, next, kind);
      clearOpenCard(params);
      if (applied) savedViews.change({ filters: boardFilterItems(next, kind) });
      if (params.toString() !== searchParams.toString()) replaceParams(params);
    },
    setSort: (next: BoardSort) => {
      if (applied) savedViews.change({ settings: { ...applied.settings, sort: next } });
      else replaceParams(boardSortParams(searchParams, next));
    },
    setLayout: (next: BoardLayout) => {
      if (applied) savedViews.change({ settings: { ...applied.settings, layout: next } });
    },
  };
}
