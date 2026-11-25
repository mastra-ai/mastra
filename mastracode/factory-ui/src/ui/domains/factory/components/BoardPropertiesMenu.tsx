import { BoardPropertiesMenu as SharedBoardPropertiesMenu } from '@mastra/playground-ui/domains/factory';
import type { LucideIcon } from 'lucide-react';

import { withBoardFilterValues } from '../boardFilters';
import type { BoardFilterFieldId } from '../boardFilters';
import { BOARD_SORT_LABELS, boardSortOptions, DEFAULT_BOARD_SORT } from '../boardSort';
import type { BoardSort } from '../boardSort';
import type { BoardView } from '../hooks/useBoardView';
import type { BoardFilterField } from './boardFilterFields';
import { IconHistory } from '@mastra/playground-ui/icons/central/IconHistory';
import { IconFilterAsc } from '@mastra/playground-ui/icons/central/IconFilterAsc';
import { IconFilterDesc } from '@mastra/playground-ui/icons/central/IconFilterDesc';
import { IconUserEdit } from '@mastra/playground-ui/icons/central/IconUserEdit';

const SORT_ICONS: Record<BoardSort, LucideIcon> = {
  recent: IconHistory,
  'recent-mine': IconUserEdit,
  'created-newest': IconFilterDesc,
  'created-oldest': IconFilterAsc,
};

export function boardPropertiesMenuProps(view: BoardView, fields: readonly BoardFilterField[], currentUserId?: string) {
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

export function BoardPropertiesMenu({
  view,
  fields,
  currentUserId,
}: {
  view: BoardView;
  fields: readonly BoardFilterField[];
  currentUserId?: string;
}) {
  return <SharedBoardPropertiesMenu {...boardPropertiesMenuProps(view, fields, currentUserId)} />;
}
