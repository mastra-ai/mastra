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

export function boardSortFromParams(params: URLSearchParams): BoardSort {
  const value = params.get('sort');
  return value && isBoardSort(value) ? value : DEFAULT_BOARD_SORT;
}

export function boardSortParams(current: URLSearchParams, sort: BoardSort): URLSearchParams {
  const next = new URLSearchParams(current);
  if (sort === DEFAULT_BOARD_SORT) next.delete('sort');
  else next.set('sort', sort);
  return next;
}
