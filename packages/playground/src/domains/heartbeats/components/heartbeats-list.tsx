import type { Heartbeat } from '@mastra/client-js';
import { DataList, DataListSkeleton } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { ScheduleStatusText } from '@/domains/schedules/components/schedule-status-badge';
import { WorkflowRunStatusInline } from '@/domains/schedules/components/workflow-run-status-inline';
import { formatRelativeTime, formatScheduleTimestamp } from '@/domains/schedules/utils/format';
import { useLinkComponent } from '@/lib/framework';

export type HeartbeatModeFilter = 'all' | 'threaded' | 'threadless';

export interface HeartbeatsListProps {
  heartbeats: Heartbeat[];
  isLoading: boolean;
  search?: string;
  mode?: HeartbeatModeFilter;
}

const COLUMNS = 'minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1fr) auto auto auto';

export function HeartbeatsList({ heartbeats, isLoading, search = '', mode = 'all' }: HeartbeatsListProps) {
  const { paths, Link } = useLinkComponent();

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return heartbeats
      .filter(h => {
        if (mode === 'threaded') return !!h.threadId;
        if (mode === 'threadless') return !h.threadId;
        return true;
      })
      .filter(h => {
        if (!term) return true;
        if (h.id.toLowerCase().includes(term)) return true;
        if (h.agentId.toLowerCase().includes(term)) return true;
        if (h.threadId?.toLowerCase().includes(term)) return true;
        if (h.name?.toLowerCase().includes(term)) return true;
        return false;
      });
  }, [heartbeats, search, mode]);

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

      {rows.map(h => (
        <DataList.RowLink key={h.id} to={paths.heartbeatLink(h.id)} LinkComponent={Link}>
          <DataList.NameCell>
            <span className="truncate" title={h.agentId}>
              {h.agentId}
            </span>
          </DataList.NameCell>
          <DataList.TextCell>
            {h.threadId ? (
              <span className="truncate font-mono text-ui-sm" title={h.threadId}>
                {h.threadId}
              </span>
            ) : (
              <span className="text-neutral4">—</span>
            )}
          </DataList.TextCell>
          <DataList.TextCell>
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <code className="font-mono text-ui-sm">{h.cron}</code>
              {h.timezone ? <span className="text-neutral4 text-ui-xs">{h.timezone}</span> : null}
            </span>
          </DataList.TextCell>
          <DataList.TextCell>
            <ScheduleStatusText status={h.status} />
          </DataList.TextCell>
          <DataList.TextCell>
            <span className="whitespace-nowrap" title={formatScheduleTimestamp(h.nextFireAt)}>
              {formatRelativeTime(h.nextFireAt)}
            </span>
          </DataList.TextCell>
          <DataList.TextCell>
            {h.lastRun ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <WorkflowRunStatusInline status={h.lastRun.status} />
                <span className="text-neutral4 text-ui-sm" title={formatScheduleTimestamp(h.lastFireAt)}>
                  {h.lastFireAt ? formatRelativeTime(h.lastFireAt) : ''}
                </span>
              </span>
            ) : h.lastFireAt ? (
              <span className="whitespace-nowrap" title={formatScheduleTimestamp(h.lastFireAt)}>
                {formatRelativeTime(h.lastFireAt)}
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
