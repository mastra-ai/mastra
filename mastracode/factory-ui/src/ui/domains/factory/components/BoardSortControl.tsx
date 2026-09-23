import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { ArrowUpDown } from 'lucide-react';

import type { BoardSort } from '../boardOrder';
import { isBoardSort } from '../boardSort';

const SORT_LABELS: Record<BoardSort, string> = {
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
    <Select
      value={value}
      onValueChange={(next: string) => {
        if (isBoardSort(next)) onChange(next);
      }}
    >
      <SelectTrigger size="sm" aria-label="Sort filed cards" className="w-auto shrink-0">
        <ArrowUpDown aria-hidden />
        Filed cards: {SORT_LABELS[value]}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="recent">{SORT_LABELS.recent}</SelectItem>
        {currentUserId ? <SelectItem value="recent-mine">{SORT_LABELS['recent-mine']}</SelectItem> : null}
        <SelectItem value="created-newest">{SORT_LABELS['created-newest']}</SelectItem>
        <SelectItem value="created-oldest">{SORT_LABELS['created-oldest']}</SelectItem>
      </SelectContent>
    </Select>
  );
}
