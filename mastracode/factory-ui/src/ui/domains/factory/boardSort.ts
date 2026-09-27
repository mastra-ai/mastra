import type { BoardSort } from './boardOrder';

export const DEFAULT_BOARD_SORT: BoardSort = 'recent';

const BOARD_SORTS: ReadonlySet<string> = new Set<BoardSort>([
  'recent',
  'recent-mine',
  'created-newest',
  'created-oldest',
]);

export function isBoardSort(value: string): value is BoardSort {
  return BOARD_SORTS.has(value);
}

export function boardSortFromParams(params: URLSearchParams, currentUserId?: string): BoardSort {
  const value = params.get('sort');
  if (!value || !isBoardSort(value)) return DEFAULT_BOARD_SORT;
  return value === 'recent-mine' && !currentUserId ? DEFAULT_BOARD_SORT : value;
}

export function boardSortParams(current: URLSearchParams, sort: BoardSort): URLSearchParams {
  const next = new URLSearchParams(current);
  if (sort === DEFAULT_BOARD_SORT) next.delete('sort');
  else next.set('sort', sort);
  return next;
}
