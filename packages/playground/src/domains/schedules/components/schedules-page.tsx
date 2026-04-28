import type { ScheduleResponse } from '@mastra/client-js';
import { ErrorState, ListSearch, Txt } from '@mastra/playground-ui';
import { useState } from 'react';
import { useScheduleTriggers } from '../hooks/use-schedule-triggers';
import { useSchedules } from '../hooks/use-schedules';
import { ScheduleTriggersList } from './schedule-triggers-list';
import { SchedulesList } from './schedules-list';

export function SchedulesPage({ workflowId }: { workflowId?: string } = {}) {
  const { data: schedules, isLoading, error } = useSchedules(workflowId ? { workflowId } : {});
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ScheduleResponse | null>(null);
  const { data: triggers, isLoading: triggersLoading } = useScheduleTriggers(selected?.id, { limit: 50 });

  if (error) {
    return <ErrorState title="Failed to load schedules" message={error.message} />;
  }

  return (
    <div className="grid grid-rows-[auto_1fr] gap-4 h-full overflow-hidden">
      <div className="max-w-120">
        <ListSearch onSearch={setSearch} label="Filter schedules" placeholder="Filter by id or workflow" />
      </div>
      <div className="grid gap-6 overflow-hidden grid-rows-[1fr_auto]">
        <div className="overflow-y-auto">
          <SchedulesList schedules={schedules ?? []} isLoading={isLoading} search={search} onSelect={setSelected} />
        </div>
        {selected ? (
          <div className="overflow-y-auto border-t border-border1 pt-4">
            <Txt variant="ui-md" className="mb-3">
              Trigger history — <code className="font-mono">{selected.id}</code>
            </Txt>
            <ScheduleTriggersList triggers={triggers ?? []} isLoading={triggersLoading} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
