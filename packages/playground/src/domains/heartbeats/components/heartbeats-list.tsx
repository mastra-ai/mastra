import type { ScheduleResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { parseHeartbeatInput } from '../utils/parse-heartbeat-input';
import { ScheduleStatusText } from '@/domains/schedules/components/schedule-status-badge';
import { WorkflowRunStatusInline } from '@/domains/schedules/components/workflow-run-status-inline';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';
import { useLinkComponent } from '@/lib/framework';

export type HeartbeatModeFilter = 'all' | 'threaded' | 'threadless';

export interface HeartbeatsListProps {
  schedules: ScheduleResponse[];
  isLoading: boolean;
  search?: string;
  mode?: HeartbeatModeFilter;
}

const COLUMNS = 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto';

export function HeartbeatsList({ schedules, isLoading, search = '', mode = 'all' }: HeartbeatsListProps) {
  const { paths, Link } = useLinkComponent();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return schedules
      .map(s => ({ schedule: s, parsed: parseHeartbeatInput(s) }))
      .filter(({ parsed }) => {
        if (mode === 'threaded') return parsed?.mode === 'threaded';
        if (mode === 'threadless') return parsed?.mode === 'threadless';
        return true;
      })
      .filter(({ schedule, parsed }) => {
        if (!term) return true;
        if (schedule.id.toLowerCase().includes(term)) return true;
        if (parsed?.agentId.toLowerCase().includes(term)) return true;
        if (parsed?.threadId?.toLowerCase().includes(term)) return true;
        return false;
      });
  }, [schedules, search, mode]);

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  return (
    <DataList columns={COLUMNS}>
      <DataList.Top>
        <DataList.TopCell>Agent</DataList.TopCell>
        <DataList.TopCell>Thread</DataList.TopCell>
        <DataList.TopCell>Cron</DataList.TopCell>
        <DataList.TopCell>Status</DataList.TopCell>
        <DataList.TopCell>Next fire</DataList.TopCell>
        <DataList.TopCell>Last run</DataList.TopCell>
      </DataList.Top>

      {rows.length === 0 && search ? <DataList.NoMatch message="No heartbeats match your search" /> : null}
      {rows.length === 0 && !search ? <DataList.NoMatch message="No heartbeats configured" /> : null}

      {rows.map(({ schedule, parsed }) => (
        <DataList.RowLink key={schedule.id} to={paths.heartbeatLink(schedule.id)} LinkComponent={Link}>
          <DataList.NameCell>
            <span className="truncate" title={parsed?.agentId ?? schedule.ownerId ?? ''}>
              {parsed?.agentId ?? schedule.ownerId ?? '—'}
            </span>
          </DataList.NameCell>
          <DataList.TextCell>
            {parsed?.threadId ? (
              <span className="truncate font-mono text-ui-sm" title={parsed.threadId}>
                {parsed.threadId}
              </span>
            ) : (
              <span className="text-neutral4">—</span>
            )}
          </DataList.TextCell>
          <DataList.TextCell>
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <code className="font-mono text-ui-sm">{schedule.cron}</code>
              {schedule.timezone ? <span className="text-neutral4 text-ui-xs">{schedule.timezone}</span> : null}
            </span>
          </DataList.TextCell>
          <DataList.TextCell>
            <ScheduleStatusText status={schedule.status} />
          </DataList.TextCell>
          <DataList.TextCell>
            <span className="whitespace-nowrap" title={formatScheduleTimestamp(schedule.nextFireAt)}>
              {formatRelativeTime(schedule.nextFireAt)}
            </span>
          </DataList.TextCell>
          <DataList.TextCell>
            {schedule.lastRun ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <WorkflowRunStatusInline status={schedule.lastRun.status} />
                <span className="text-neutral4 text-ui-sm" title={formatScheduleTimestamp(schedule.lastFireAt)}>
                  {schedule.lastFireAt ? formatRelativeTime(schedule.lastFireAt) : ''}
                </span>
              </span>
            ) : schedule.lastFireAt ? (
              <span className="whitespace-nowrap" title={formatScheduleTimestamp(schedule.lastFireAt)}>
                {formatRelativeTime(schedule.lastFireAt)}
              </span>
            ) : (
              <span className="text-neutral4">Never</span>
            )}
          </DataList.TextCell>
        </DataList.RowLink>
      ))}
    </DataList>
  );
}
