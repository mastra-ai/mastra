import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { useState } from 'react';
import { useSchedules } from '../hooks/use-schedules';
import { SchedulesList } from './schedules-list';

export function SchedulesPage({ workflowId }: { workflowId?: string } = {}) {
  const { data: schedules, isLoading, error } = useSchedules(workflowId ? { workflowId } : {});
  const [search, setSearch] = useState('');

  if (error) {
    return <ErrorState title="Failed to load schedules" message={error.message} />;
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
