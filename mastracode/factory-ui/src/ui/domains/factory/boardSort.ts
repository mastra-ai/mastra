import { BOARD_SORTS } from './boardOrder';
import type { BoardSort } from './boardOrder';

export const BOARD_SORT_QUERY = 'sort';

export const DEFAULT_BOARD_SORT: BoardSort = 'recent';

export const BOARD_SORT_LABELS: Record<BoardSort, string> = {
  recent: 'Recently moved',
  'recent-mine': 'Recently moved by me',
  'created-newest': 'Newest on board',
  'created-oldest': 'Oldest on board',
};

export function boardSortOptions(currentUserId?: string): { value: BoardSort; label: string }[] {
  return BOARD_SORTS.filter(sort => sort !== 'recent-mine' || currentUserId).map(sort => ({
    value: sort,
    label: BOARD_SORT_LABELS[sort],
  }));
}

export function isBoardSort(value: string): value is BoardSort {
  return BOARD_SORTS.some(sort => sort === value);
}

export function boardSortFromParams(params: URLSearchParams, currentUserId?: string): BoardSort {
  const value = params.get(BOARD_SORT_QUERY);
  if (!value || !isBoardSort(value)) return DEFAULT_BOARD_SORT;
  return value === 'recent-mine' && !currentUserId ? DEFAULT_BOARD_SORT : value;
}

export function boardSortParams(current: URLSearchParams, sort: BoardSort): URLSearchParams {
  const next = new URLSearchParams(current);
  if (sort === DEFAULT_BOARD_SORT) next.delete(BOARD_SORT_QUERY);
  else next.set(BOARD_SORT_QUERY, sort);
  return next;
}
