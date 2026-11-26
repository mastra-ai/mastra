import type { ReactNode } from 'react';

import type { BoardLayout } from './board-layout';

import type { SavedViewsController } from '@/ds/components/SavedViews';

export type BoardFilterValues = Readonly<Record<string, ReadonlySet<string>>>;

export interface BoardViewSettings<Sort extends string = string> {
  sort: Sort;
  layout: BoardLayout;
}

export interface BoardSortOption<Sort extends string = string> {
  value: Sort;
  label: string;
  icon?: ReactNode;
}

/** What the board toolbar reads and drives; the host decides where it lives (URL, local state). */
export interface BoardViewState<Sort extends string = string> {
  savedViews: SavedViewsController<BoardViewSettings<Sort>>;
  filters: BoardFilterValues;
  search: string;
  sort: Sort;
  layout: BoardLayout;
  newViewSettings: BoardViewSettings<Sort>;
  setSearch: (next: string) => void;
  setSort: (next: Sort) => void;
  setLayout: (next: BoardLayout) => void;
  resetProperties: () => void;
  saveAsView: () => void;
}

export function boardFilterValuesActive(filters: BoardFilterValues): boolean {
  return Object.values(filters).some(values => values.size > 0);
}
