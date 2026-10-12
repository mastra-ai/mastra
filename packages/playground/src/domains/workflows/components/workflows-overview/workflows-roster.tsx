import { DataList } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { formatCount } from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { isWorkflowActive, workflowComposition } from './workflow-roster-row';
import type { WorkflowRosterRow, WorkflowSortKey } from './workflow-roster-row';
import {
  RosterErrorRateCell,
  RosterLastRunCell,
  RosterLatencyCell,
  RosterNameCell,
  RosterRunsCell,
} from '@/domains/overview/components/roster-cells';
import type { LatencyStatus } from '@/domains/overview/components/roster-cells';
import type { OverviewRange } from '@/domains/overview/overview-period';
import { cn } from '@/lib/utils';

export interface WorkflowsRosterActivity {
  range: OverviewRange;
  nowMs: number;
  latencyStatus: LatencyStatus;
}

function columnsFor(activity: WorkflowsRosterActivity | undefined, showsSuspended: boolean) {
  return [
    'minmax(12rem,2fr)',
    activity && 'minmax(8rem,1.2fr)',
    activity && '4.5rem',
    activity && activity.latencyStatus !== 'error' && '4.5rem',
    showsSuspended && '5.5rem',
    activity && '9rem',
  ]
    .filter(Boolean)
    .join(' ');
}

export function WorkflowsRoster({
  rows,
  activity,
  showsSuspended,
  sort,
  onSortChange,
}: {
  rows: WorkflowRosterRow[];
  activity?: WorkflowsRosterActivity;
  showsSuspended: boolean;
  sort: ListSort<WorkflowSortKey>;
  onSortChange: (direction: DataListSort, key: WorkflowSortKey) => void;
}) {
  const { Link, paths } = useLinkComponent();
  const sortFor = (key: WorkflowSortKey) => (sort?.key === key ? sort.direction : undefined);
  const sortableHead = (sortKey: WorkflowSortKey, label: string, align?: 'end') => (
    <DataList.SortableTopCell sortKey={sortKey} sort={sortFor(sortKey)} onSortChange={onSortChange} align={align}>
      {label}
    </DataList.SortableTopCell>
  );
  const showsLatency = activity && activity.latencyStatus !== 'error';

  return (
    <DataList
      columns={columnsFor(activity, showsSuspended)}
      fit="container"
      scroll="page"
      variant="light"
      className="min-w-0"
    >
      <DataList.Top>
        {sortableHead('name', 'Workflow')}
        {activity && sortableHead('runs', 'Runs', 'end')}
        {activity && sortableHead('failureRate', 'Failures', 'end')}
        {showsLatency && sortableHead('p95', 'p95', 'end')}
        {showsSuspended && sortableHead('suspended', 'Suspended', 'end')}
        {activity && sortableHead('lastRun', 'Last run')}
      </DataList.Top>
      {rows.length === 0 ? (
        <DataList.NoMatch message="No workflows match your search" />
      ) : (
        rows.map(row => (
          <DataList.RowLink key={row.id} to={paths.workflowLink(row.id)} LinkComponent={Link}>
            <RosterNameCell name={row.name} meta={workflowComposition(row.workflow)} isIdle={!isWorkflowActive(row)} />
            {activity && row.activity && (
              <>
                <RosterRunsCell name={row.name} activity={row.activity} range={activity.range} errorNoun="failed" />
                <RosterErrorRateCell activity={row.activity} />
                {showsLatency && <RosterLatencyCell latency={row.latency} status={activity.latencyStatus} />}
              </>
            )}
            {showsSuspended && (
              <DataList.NumberCell className={cn(row.suspended > 0 && 'text-warning-foreground')}>
                {row.suspended > 0 ? formatCount(row.suspended) : ''}
              </DataList.NumberCell>
            )}
            {activity && row.activity && (
              <RosterLastRunCell activity={row.activity} range={activity.range} nowMs={activity.nowMs} />
            )}
          </DataList.RowLink>
        ))
      )}
    </DataList>
  );
}
