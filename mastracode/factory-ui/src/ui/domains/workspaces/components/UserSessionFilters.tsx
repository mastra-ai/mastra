import { Button } from '@mastra/playground-ui/components/Button';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ListFilter } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  ALL_SESSION_OWNERS,
  MY_SESSIONS,
  activeUserSessionFilterCount,
  sessionOwnerFilterValue,
} from '../services/sessionFilters';
import type { UserSessionFiltersState } from '../services/sessionFilters';

export interface UserSessionOwnerOption {
  userId: string;
  name: string;
}

export function UserSessionFilters({
  filters,
  owners,
  viewerUserId,
  onChange,
  onClear,
}: {
  filters: UserSessionFiltersState;
  owners: readonly UserSessionOwnerOption[];
  viewerUserId?: string;
  onChange: (filters: UserSessionFiltersState) => void;
  onClear: () => void;
}) {
  const activeCount = activeUserSessionFilterCount(filters);
  const triggerLabel = activeCount === 0 ? 'Filter sessions' : `Filter sessions, ${activeCount} active`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant={activeCount > 0 ? 'default' : 'ghost'} size="icon-sm" aria-label={triggerLabel}>
          <ListFilter size={15} />
          {activeCount > 0 ? <span className="sr-only">{activeCount} active</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-4">
          <ListSearch
            label="Search sessions"
            placeholder="Search sessions…"
            value={filters.search}
            onSearch={search => onChange({ ...filters, search })}
            shortcutDisabled
            size="sm"
          />

          <FilterSelect label="Owner" value={filters.owner} onValueChange={owner => onChange({ ...filters, owner })}>
            <SelectItem value={ALL_SESSION_OWNERS}>All owners</SelectItem>
            {viewerUserId ? <SelectItem value={MY_SESSIONS}>Mine</SelectItem> : null}
            {owners.map(owner => (
              <SelectItem key={owner.userId} value={sessionOwnerFilterValue(owner.userId)}>
                {owner.name}
              </SelectItem>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Status"
            value={filters.status}
            onValueChange={status => onChange({ ...filters, status })}
          >
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="working">Working</SelectItem>
            <SelectItem value="initializing">Initializing</SelectItem>
            <SelectItem value="idle">Idle</SelectItem>
          </FilterSelect>

          <FilterSelect
            label="Updated"
            value={filters.updated}
            onValueChange={updated => onChange({ ...filters, updated })}
          >
            <SelectItem value="all">Any time</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </FilterSelect>

          <Button type="button" variant="ghost" size="sm" disabled={activeCount === 0} onClick={onClear}>
            Clear filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect<Value extends string>({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: Value;
  onValueChange: (value: Value) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Txt as="span" variant="ui-xs" className="text-icon4">
        {label}
      </Txt>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger variant="outline" size="sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}
