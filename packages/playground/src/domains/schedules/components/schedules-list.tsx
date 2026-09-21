import type { ScheduleResponse } from '@mastra/client-js';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { sortBy } from '@mastra/playground-ui/sort/sort-by';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { useMemo } from 'react';
import { formatScheduleTimestamp, formatRelativeTime } from '../utils/format';
import { ScheduleStatusText } from './schedule-status-badge';
import { WorkflowRunStatusInline } from './workflow-run-status-inline';
import { useLinkComponent } from '@/lib/framework';

export type SchedulesSortKey = 'target' | 'status' | 'nextFireAt' | 'lastFireAt';
export type SchedulesSort = ListSort<SchedulesSortKey>;

export interface SchedulesListProps {
  schedules: ScheduleResponse[];
  isLoading: boolean;
  search?: string;
  sort?: SchedulesSort;
  onSortChange?: (direction: DataListSort, key: SchedulesSortKey) => void;
}

const sortAccessors = {
  target: (s: ScheduleResponse) => s.workflowId ?? s.agentId ?? '',
  status: (s: ScheduleResponse) => s.status,
  nextFireAt: (s: ScheduleResponse) => s.nextFireAt,
  lastFireAt: (s: ScheduleResponse) => s.lastFireAt,
};

const COLUMNS = 'minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 1fr) auto auto auto';

export function SchedulesList({ schedules, isLoading, search = '', sort, onSortChange }: SchedulesListProps) {
  const { paths, Link } = useLinkComponent();

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    const matching = term
      ? schedules.filter(
          s => s.id.toLowerCase().includes(term) || (s.workflowId ?? s.agentId ?? '').toLowerCase().includes(term),
        )
      : schedules;
    return sortBy(matching, sort, sortAccessors);
  }, [schedules, search, sort]);

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filtered.length, global: true });

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  const header = (key: SchedulesSortKey, label: string) =>
    onSortChange ? (
      <DataList.SortableTopCell
        sortKey={key}
        sort={sort?.key === key ? sort.direction : undefined}
        onSortChange={onSortChange}
      >
        {label}
      </DataList.SortableTopCell>
    ) : (
      <DataList.TopCell>{label}</DataList.TopCell>
    );

  return (
    <DataList columns={COLUMNS} className="min-w-0" scrollRef={containerRef}>
      <DataList.Top>
        {header('target', 'Target')}
        <DataList.TopCell>Schedule ID</DataList.TopCell>
        <DataList.TopCell>Cron</DataList.TopCell>
        {header('status', 'Status')}
        {header('nextFireAt', 'Next fire')}
        {header('lastFireAt', 'Last run')}
      </DataList.Top>

      {filtered.length === 0 && search ? <DataList.NoMatch message="No schedules match your search" /> : null}
      {filtered.length === 0 && !search ? <DataList.NoMatch message="No schedules configured" /> : null}

      {filtered.map((s, index) => (
        <DataList.RowLink key={s.id} to={paths.scheduleLink(s.id)} LinkComponent={Link} {...getRowProps(index)}>
          <DataList.NameCell>{s.workflowId ?? s.agentId}</DataList.NameCell>
          <DataList.Cell className="min-w-0">
            <span className="text-ui-smd text-muted-foreground block truncate font-mono" title={s.id}>
              {s.id}
            </span>
          </DataList.Cell>
          <DataList.Cell>
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <code className="text-ui-sm font-mono">{s.cron}</code>
              {s.timezone ? <span className="text-muted-foreground text-ui-xs">{s.timezone}</span> : null}
            </span>
          </DataList.Cell>
          <DataList.Cell>
            <ScheduleStatusText status={s.status} />
          </DataList.Cell>
          <DataList.Cell>
            <span className="whitespace-nowrap" title={formatScheduleTimestamp(s.nextFireAt)}>
              {formatRelativeTime(s.nextFireAt)}
            </span>
          </DataList.Cell>
          <DataList.Cell>
            {s.lastRun ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <WorkflowRunStatusInline status={s.lastRun.status} />
                <span className="text-muted-foreground text-ui-sm" title={formatScheduleTimestamp(s.lastFireAt)}>
                  {s.lastFireAt ? formatRelativeTime(s.lastFireAt) : ''}
                </span>
              </span>
            ) : s.lastFireAt ? (
              <span className="whitespace-nowrap" title={formatScheduleTimestamp(s.lastFireAt)}>
                {formatRelativeTime(s.lastFireAt)}
              </span>
            ) : (
              <span className="text-muted-foreground">Never</span>
            )}
          </DataList.Cell>
        </DataList.RowLink>
      ))}
    </DataList>
  );
}
