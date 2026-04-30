import type { ScheduleResponse } from '@mastra/client-js';
import { EntityList, EntityListSkeleton } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { formatScheduleTimestamp, formatRelativeTime } from '../utils/format';
import { ScheduleStatusBadge } from './schedule-status-badge';
import { WorkflowRunStatusBadge } from '@/domains/workflows/components/workflow-run-status-badge';

export interface SchedulesListProps {
  schedules: ScheduleResponse[];
  isLoading: boolean;
  search?: string;
  onSelect?: (schedule: ScheduleResponse) => void;
}

const COLUMNS = 'auto auto auto auto auto auto';

export function SchedulesList({ schedules, isLoading, search = '', onSelect }: SchedulesListProps) {
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return schedules;
    return schedules.filter(s => s.id.toLowerCase().includes(term) || s.target.workflowId.toLowerCase().includes(term));
  }, [schedules, search]);

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS}>
      <EntityList.Top>
        <EntityList.TopCell>Workflow</EntityList.TopCell>
        <EntityList.TopCell>Schedule ID</EntityList.TopCell>
        <EntityList.TopCell>Cron</EntityList.TopCell>
        <EntityList.TopCell>Status</EntityList.TopCell>
        <EntityList.TopCell>Next fire</EntityList.TopCell>
        <EntityList.TopCell>Last run</EntityList.TopCell>
      </EntityList.Top>

      {filtered.length === 0 && search ? <EntityList.NoMatch message="No schedules match your search" /> : null}
      {filtered.length === 0 && !search ? <EntityList.NoMatch message="No schedules configured" /> : null}

      {filtered.map(s => (
        <EntityList.Row key={s.id} onClick={onSelect ? () => onSelect(s) : undefined}>
          <EntityList.NameCell>{s.target.workflowId}</EntityList.NameCell>
          <EntityList.TextCell>{s.id}</EntityList.TextCell>
          <EntityList.TextCell>
            <code className="font-mono text-ui-sm">{s.cron}</code>
            {s.timezone ? <span className="text-neutral4 ml-2">({s.timezone})</span> : null}
          </EntityList.TextCell>
          <EntityList.TextCell>
            <ScheduleStatusBadge status={s.status} />
          </EntityList.TextCell>
          <EntityList.TextCell>
            <span title={formatScheduleTimestamp(s.nextFireAt)}>{formatRelativeTime(s.nextFireAt)}</span>
          </EntityList.TextCell>
          <EntityList.TextCell>
            {s.lastRun ? (
              <div className="flex items-center gap-2">
                <WorkflowRunStatusBadge status={s.lastRun.status} />
                <span className="text-neutral4 text-ui-sm" title={formatScheduleTimestamp(s.lastFireAt)}>
                  {s.lastFireAt ? formatRelativeTime(s.lastFireAt) : ''}
                </span>
              </div>
            ) : s.lastFireAt ? (
              <span title={formatScheduleTimestamp(s.lastFireAt)}>{formatRelativeTime(s.lastFireAt)}</span>
            ) : (
              <span className="text-neutral4">Never</span>
            )}
          </EntityList.TextCell>
        </EntityList.Row>
      ))}
    </EntityList>
  );
}
