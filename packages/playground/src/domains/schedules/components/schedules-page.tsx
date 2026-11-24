import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { SearchInput, listSearchProps } from '@mastra/playground-ui/components/SearchInput';
import { useSchedules } from '@mastra/react/hooks/schedules';
import { useState } from 'react';
import { SchedulesList } from './schedules-list';
import type { SchedulesSort } from './schedules-list';

export function SchedulesPage({ workflowId }: { workflowId?: string } = {}) {
  const { data: schedules, isLoading, error } = useSchedules(workflowId ? { workflowId } : {});
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SchedulesSort>();

  if (error) {
    return <EmptyState tone="error" titleSlot="Failed to load schedules" descriptionSlot={error.message} />;
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden">
      <div className="max-w-120">
        <SearchInput
          {...listSearchProps}
          onValueChange={setSearch}
          label="Search schedules"
          placeholder="Search by id or workflow"
        />
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
