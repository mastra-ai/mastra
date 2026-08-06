import type { ScheduleResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton } from '@mastra/playground-ui/components/DataList';
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
    return schedules.filter(
      s => s.id.toLowerCase().includes(term) || (s.workflowId ?? s.agentId ?? '').toLowerCase().includes(term),
    );
  }, [schedules, search]);

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  return (
    <DataList columns={COLUMNS} variant="striped" className="min-w-0">
      <DataList.Top>
        <DataList.TopCell>Target</DataList.TopCell>
        <DataList.TopCell>Schedule ID</DataList.TopCell>
        <DataList.TopCell>Cron</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Next fire</DataList.TopCell>
        <DataList.TopCell>Last run</DataList.TopCell>
      </DataList.Top>

      {filtered.length === 0 && search ? <DataList.NoMatch message="No schedules match your search" /> : null}
      {filtered.length === 0 && !search ? <DataList.NoMatch message="No schedules configured" /> : null}

      {filtered.map(s => (
        <DataList.RowLink key={s.id} to={paths.scheduleLink(s.id)} LinkComponent={Link}>
          <DataList.NameCell>{s.workflowId ?? s.agentId}</DataList.NameCell>
          <DataList.Cell height="compact" className="min-w-0">
            <span className="text-ui-smd text-neutral3 block truncate font-mono" title={s.id}>
              {s.id}
            </span>
          </DataList.Cell>
          <DataList.Cell height="compact">
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <code className="text-ui-sm font-mono">{s.cron}</code>
              {s.timezone ? <span className="text-neutral4 text-ui-xs">{s.timezone}</span> : null}
            </span>
          </DataList.Cell>
          <DataList.Cell height="compact">
            <ScheduleStatusText status={s.status} />
          </DataList.Cell>
          <DataList.Cell height="compact">
            <span className="whitespace-nowrap" title={formatScheduleTimestamp(s.nextFireAt)}>
              {formatRelativeTime(s.nextFireAt)}
            </span>
          </DataList.Cell>
          <DataList.Cell height="compact">
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
          </DataList.Cell>
        </DataList.RowLink>
      ))}
    </DataList>
  );
}
