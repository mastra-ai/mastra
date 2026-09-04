import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { useState } from 'react';
import { useSchedules } from '../hooks/use-schedules';
import { SchedulesList } from './schedules-list';

export function SchedulesPage({ workflowId }: { workflowId?: string } = {}) {
  const { data: schedules, isLoading, error } = useSchedules(workflowId ? { workflowId } : {});
  const [search, setSearch] = useState('');

  if (error) {
    return <QueryError error={error} title="Failed to load schedules" />;
  }

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-4 overflow-hidden">
      <div className="max-w-120">
        <ListSearch onSearch={setSearch} label="Filter schedules" placeholder="Filter by id or workflow" />
      </div>
      <div className="overflow-y-auto">
        <SchedulesList schedules={schedules ?? []} isLoading={isLoading} search={search} />
      </div>
    </div>
  );
}
