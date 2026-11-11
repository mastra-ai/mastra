import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@mastra/playground-ui/components/InputGroup';
import { useListSearch } from '@mastra/playground-ui/hooks/use-list-search';
import { useSchedules } from '@mastra/react/hooks/schedules';
import { SearchIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { SchedulesList } from './schedules-list';
import type { SchedulesSort } from './schedules-list';

export function SchedulesPage({ workflowId }: { workflowId?: string } = {}) {
  const { data: schedules, isLoading, error } = useSchedules(workflowId ? { workflowId } : {});
  const [search, setSearch] = useState('');
  const searchField = useListSearch({ onSearch: setSearch });
  const [sort, setSort] = useState<SchedulesSort>();

  if (error) {
    return <EmptyState tone="error" titleSlot="Failed to load schedules" descriptionSlot={error.message} />;
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden">
      <div className="max-w-120">
        <InputGroup size="sm" className="w-full max-w-120">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            {...searchField.inputProps}
            aria-label="Search schedules"
            placeholder="Search by id or workflow"
          />
          {searchField.value && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton aria-label="Clear search" onClick={searchField.clear}>
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      </div>
      <div className="overflow-y-auto">
        <SchedulesList
          schedules={schedules ?? []}
          isLoading={isLoading}
          search={search}
          sort={sort}
          onSortChange={(direction, key) => setSort({ key, direction })}
        />
      </div>
    </div>
  );
}
