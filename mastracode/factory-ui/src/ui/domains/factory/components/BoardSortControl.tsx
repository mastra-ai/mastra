import { SortMenu } from '@mastra/playground-ui/components/SortMenu';

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
  const options = BOARD_SORTS.filter(sort => sort !== 'recent-mine' || currentUserId).map(sort => ({
    value: sort,
    label: BOARD_SORT_LABELS[sort],
  }));

  return (
    <SortMenu
      label="Sort filed cards"
      options={options}
      value={value}
      baselineValue={DEFAULT_BOARD_SORT}
      onValueChange={onChange}
    />
  );
}
