import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { ArrowUpDown } from 'lucide-react';

import type { BoardSort } from '../boardOrder';
import { DEFAULT_BOARD_SORT, isBoardSort } from '../boardSort';

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
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        size="icon-sm"
        variant={value === DEFAULT_BOARD_SORT ? 'default' : 'primary'}
        aria-label="Sort filed cards"
        tooltip={`Sort filed cards: ${BOARD_SORT_LABELS[value]}`}
      >
        <ArrowUpDown aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Label>Sort filed cards</DropdownMenu.Label>
        <DropdownMenu.RadioGroup
          value={value}
          onValueChange={next => {
            if (isBoardSort(next)) onChange(next);
          }}
        >
          <DropdownMenu.RadioItem value="recent">{BOARD_SORT_LABELS.recent}</DropdownMenu.RadioItem>
          {currentUserId ? (
            <DropdownMenu.RadioItem value="recent-mine">{BOARD_SORT_LABELS['recent-mine']}</DropdownMenu.RadioItem>
          ) : null}
          <DropdownMenu.RadioItem value="created-newest">{BOARD_SORT_LABELS['created-newest']}</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="created-oldest">{BOARD_SORT_LABELS['created-oldest']}</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
