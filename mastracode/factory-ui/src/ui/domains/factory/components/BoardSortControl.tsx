import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpDown } from 'lucide-react';

import { BOARD_SORTS } from '../boardOrder';
import type { BoardSort } from '../boardOrder';
import { DEFAULT_BOARD_SORT } from '../boardSort';

export const BOARD_SORT_LABELS: Record<BoardSort, string> = {
  recent: 'Recently moved',
  'recent-mine': 'Recently moved by me',
  'created-newest': 'Newest on board',
  'created-oldest': 'Oldest on board',
};

export function BoardSortControl({
  value,
  currentUserId,
  onChange,
}: {
  value: BoardSort;
  currentUserId?: string;
  onChange: (sort: BoardSort) => void;
}) {
  const triggerLabel = `Sort filed cards: ${BOARD_SORT_LABELS[value]}`;
  const options = BOARD_SORTS.filter(sort => sort !== 'recent-mine' || currentUserId).map(sort => ({
    value: sort,
    label: BOARD_SORT_LABELS[sort],
  }));

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        size="icon-sm"
        variant={value === DEFAULT_BOARD_SORT ? 'default' : 'primary'}
        aria-label={triggerLabel}
        tooltip={triggerLabel}
      >
        <ArrowUpDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Label>Sort filed cards</DropdownMenu.Label>
        <DropdownMenu.RadioOptions options={options} value={value} onValueChange={onChange} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
