import { useBoardNavigation, boardLayoutFromParams, boardLayoutParams } from '../board';

import type { BoardLayout } from '../board';
import type { BoardKind } from '../card';
import {
  boardFilterItems,
  boardFilterParams,
  boardFilterStateFromItems,
  boardFiltersFromParams,
  clearOpenCard,
} from './board-filters';
import type { BoardFilterState } from './board-filters';
import { withPeopleFolded, withPeopleUnfolded } from './board-people';
import type { PersonIdentity } from './board-people';
import { BOARD_VIEW_QUERY, boardViewSettingsSchema, savedBoardViewsStorageKey } from './board-saved-views';
import type { FactoryBoardViewSettings } from './board-saved-views';
import { boardSortFromParams, boardSortParams, DEFAULT_BOARD_SORT } from './board-sort';
import type { BoardSort } from './board-sort';
import { useSavedViews } from '@/ds/components/SavedViews';
import type { SavedViewsController } from '@/ds/components/SavedViews';

export const BOARD_SEARCH_QUERY = 'search';

export interface BoardView {
  searchParams: URLSearchParams;
  savedViews: SavedViewsController<FactoryBoardViewSettings>;
  filters: BoardFilterState;
  search: string;
  sort: BoardSort;
  layout: BoardLayout;
  newViewSettings: FactoryBoardViewSettings;
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
  reviewsPullRequests,
  currentUserId,
  personId,
}: {
  factoryProjectId: string;
  kind: BoardKind;
  /** Whether the board reviews pull requests, so offers the requested-reviewer filter. */
  reviewsPullRequests: boolean;
  currentUserId?: string;
  personId: PersonIdentity;
}): BoardView {
  const { searchParams, replaceSearchParams } = useBoardNavigation();

  const replaceParams = replaceSearchParams;

  const savedViews = useSavedViews<FactoryBoardViewSettings>({
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
  const pageSettings: FactoryBoardViewSettings = {
    sort: boardSortFromParams(searchParams, currentUserId),
    layout: boardLayoutFromParams(searchParams),
  };
  const storedFilters = applied
    ? boardFilterStateFromItems(applied.filters, reviewsPullRequests)
    : boardFiltersFromParams(searchParams, reviewsPullRequests);
  const filters = withPeopleFolded(storedFilters, personId);
  const settings = applied?.settings ?? pageSettings;
  const sort = settings.sort === 'recent-mine' && !currentUserId ? DEFAULT_BOARD_SORT : settings.sort;

  return {
    searchParams,
    savedViews,
    filters,
    search: searchParams.get(BOARD_SEARCH_QUERY) ?? '',
    sort,
    layout: settings.layout,
    newViewSettings: { ...settings, sort },
    setSearch: next => {
      const params = new URLSearchParams(searchParams);
      if (next) params.set(BOARD_SEARCH_QUERY, next);
      else params.delete(BOARD_SEARCH_QUERY);
      clearOpenCard(params);
      replaceSearchParams(params);
    },
    setFilters: (next: BoardFilterState) => {
      const stored = withPeopleUnfolded(next, personId);
      const params = applied ? new URLSearchParams(searchParams) : boardFilterParams(searchParams, stored);
      clearOpenCard(params);
      if (applied) savedViews.change({ filters: boardFilterItems(stored) });
      if (params.toString() !== searchParams.toString()) replaceParams(params);
    },
    saveAsView: () => savedViews.create({ ...settings, sort }, boardFilterItems(withPeopleUnfolded(filters, personId))),
    clearFilters: () => {
      const params = applied
        ? new URLSearchParams(searchParams)
        : boardFilterParams(searchParams, boardFilterStateFromItems([], reviewsPullRequests));
      params.delete(BOARD_SEARCH_QUERY);
      clearOpenCard(params);
      if (applied) savedViews.change({ filters: [] });
      replaceParams(params);
    },
    setSort: (next: BoardSort) => {
      if (applied) savedViews.change({ settings: { ...applied.settings, sort: next } });
      else replaceParams(boardSortParams(searchParams, next));
    },
    setLayout: (next: BoardLayout) => {
      if (applied) savedViews.change({ settings: { ...applied.settings, layout: next } });
      else replaceParams(boardLayoutParams(searchParams, next));
    },
    resetProperties: () => {
      if (applied) {
        savedViews.change({ filters: [], settings: { ...applied.settings, sort: DEFAULT_BOARD_SORT } });
        return;
      }
      const params = boardSortParams(
        boardFilterParams(searchParams, boardFilterStateFromItems([], reviewsPullRequests)),
        DEFAULT_BOARD_SORT,
      );
      clearOpenCard(params);
      replaceParams(params);
    },
  };
}
