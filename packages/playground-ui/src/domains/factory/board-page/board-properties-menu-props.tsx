import type { LucideIcon } from 'lucide-react';

import type { FactoryBoardFilterField } from './board-filter-fields';
import { withBoardFilterValues } from './board-filters';
import type { BoardFilterFieldId } from './board-filters';
import { BOARD_SORT_LABELS, boardSortOptions, DEFAULT_BOARD_SORT } from './board-sort';
import type { BoardSort } from './board-sort';
import type { BoardView } from './use-board-view';
import { IconFilterAsc } from '@/ds/icons/central/IconFilterAsc';
import { IconFilterDesc } from '@/ds/icons/central/IconFilterDesc';
import { IconHistory } from '@/ds/icons/central/IconHistory';
import { IconUserEdit } from '@/ds/icons/central/IconUserEdit';

const SORT_ICONS: Record<BoardSort, LucideIcon> = {
  recent: IconHistory,
  'recent-mine': IconUserEdit,
  'created-newest': IconFilterDesc,
  'created-oldest': IconFilterAsc,
};

export function boardPropertiesMenuProps(
  view: BoardView,
  fields: readonly FactoryBoardFilterField[],
  currentUserId?: string,
) {
  return {
    view,
    fields,
    sortLabels: BOARD_SORT_LABELS,
    defaultSort: DEFAULT_BOARD_SORT,
    sortOptions: boardSortOptions(currentUserId).map(option => {
      const Icon = SORT_ICONS[option.value];
      return { ...option, icon: <Icon aria-hidden /> };
    }),
    onFilterChange: (fieldId: BoardFilterFieldId, values: string[]) =>
      view.setFilters(withBoardFilterValues(view.filters, fieldId, values)),
  };
}
