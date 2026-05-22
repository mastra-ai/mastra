import type { ScheduleResponse } from '@mastra/client-js';
import { EntityList, EntityListSkeleton } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { formatScheduleTimestamp, formatRelativeTime } from '../utils/format';
import { ScheduleStatusText } from './schedule-status-badge';
import { WorkflowRunStatusInline } from './workflow-run-status-inline';
import { useLinkComponent } from '@/lib/framework';

export interface SchedulesListProps {
  schedules: ScheduleResponse[];
  isLoading: boolean;
  search?: string;
}

const COLUMNS = 'minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 1fr) auto auto auto';

export function SchedulesList({ schedules, isLoading, search = '' }: SchedulesListProps) {
  const { paths, Link } = useLinkComponent();

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
        <EntityList.RowLink key={s.id} to={paths.scheduleLink(s.id)} LinkComponent={Link}>
          <EntityList.NameCell>
            <span className="truncate">{s.target.workflowId}</span>
          </EntityList.NameCell>
          <EntityList.TextCell>
            <span className="truncate font-mono text-ui-sm" title={s.id}>
              {s.id}
            </span>
          </EntityList.TextCell>
          <EntityList.TextCell>
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <code className="font-mono text-ui-sm">{s.cron}</code>
              {s.timezone ? <span className="text-neutral4 text-ui-xs">{s.timezone}</span> : null}
            </span>
          </EntityList.TextCell>
          <EntityList.TextCell>
            <ScheduleStatusText status={s.status} />
          </EntityList.TextCell>
          <EntityList.TextCell>
            <span className="whitespace-nowrap" title={formatScheduleTimestamp(s.nextFireAt)}>
              {formatRelativeTime(s.nextFireAt)}
            </span>
          </EntityList.TextCell>
          <EntityList.TextCell>
            {s.lastRun ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <WorkflowRunStatusInline status={s.lastRun.status} />
                <span className="text-neutral4 text-ui-sm" title={formatScheduleTimestamp(s.lastFireAt)}>
                  {s.lastFireAt ? formatRelativeTime(s.lastFireAt) : ''}
                </span>
              </span>
            ) : s.lastFireAt ? (
              <span className="whitespace-nowrap" title={formatScheduleTimestamp(s.lastFireAt)}>
                {formatRelativeTime(s.lastFireAt)}
              </span>
            ) : (
              <span className="text-neutral4">Never</span>
            )}
          </EntityList.TextCell>
        </EntityList.RowLink>
      ))}
    </EntityList>
  );
}
