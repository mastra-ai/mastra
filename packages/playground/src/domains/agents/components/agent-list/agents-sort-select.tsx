import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import type { AgentsSort } from './agents-sort';

export interface AgentsSortSelectProps {
  sort: AgentsSort;
  onSortChange: (sort: AgentsSort) => void;
}

export function AgentsSortSelect({ sort, onSortChange }: AgentsSortSelectProps) {
  return (
    <Select<AgentsSort> value={sort} onValueChange={onSortChange}>
      <SelectTrigger aria-label="Sort agents" size="md" variant="ghost" className="w-auto min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="default">Default order</SelectItem>
        <SelectItem value="name-asc">Name: A–Z</SelectItem>
        <SelectItem value="name-desc">Name: Z–A</SelectItem>
      </SelectContent>
    </Select>
  );
}
