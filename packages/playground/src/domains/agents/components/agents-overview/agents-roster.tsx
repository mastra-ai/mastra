import { DataList } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { formatUsd } from '@mastra/playground-ui/domains/metrics/lib/chart-format';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ListSort } from '@mastra/playground-ui/sort/sort-by';
import { agentComposition, isAgentActive } from './agent-roster-row';
import type { AgentRosterRow, AgentSortKey } from './agent-roster-row';
import {
  RosterErrorRateCell,
  RosterLastRunCell,
  RosterLatencyCell,
  RosterNameCell,
  RosterRunsCell,
} from '@/domains/overview/components/roster-cells';
import type { LatencyStatus } from '@/domains/overview/components/roster-cells';
import type { OverviewRange } from '@/domains/overview/overview-period';

export interface AgentsRosterActivity {
  range: OverviewRange;
  nowMs: number;
  totalCost: number;
  latencyStatus: LatencyStatus;
  showsScores: boolean;
}

function columnsFor(activity: AgentsRosterActivity | undefined) {
  if (!activity) return 'minmax(0,1fr)';
  return [
    'minmax(12rem,2fr)',
    'minmax(8rem,1.2fr)',
    '4.5rem',
    activity.latencyStatus !== 'error' && '4.5rem',
    'minmax(7rem,1fr)',
    activity.showsScores && '4rem',
    '9rem',
  ]
    .filter(Boolean)
    .join(' ');
}

export function AgentsRoster({
  rows,
  activity,
  sort,
  onSortChange,
}: {
  rows: AgentRosterRow[];
  activity?: AgentsRosterActivity;
  sort: ListSort<AgentSortKey>;
  onSortChange: (direction: DataListSort, key: AgentSortKey) => void;
}) {
  const { Link, paths } = useLinkComponent();
  const sortFor = (key: AgentSortKey) => (sort?.key === key ? sort.direction : undefined);
  const sortableHead = (sortKey: AgentSortKey, label: string, align?: 'end') => (
    <DataList.SortableTopCell sortKey={sortKey} sort={sortFor(sortKey)} onSortChange={onSortChange} align={align}>
      {label}
    </DataList.SortableTopCell>
  );

  return (
    <DataList columns={columnsFor(activity)} fit="container" scroll="page" variant="light" className="min-w-0">
      <DataList.Top>
        {sortableHead('name', 'Agent')}
        {activity && (
          <>
            {sortableHead('runs', 'Runs', 'end')}
            {sortableHead('errorRate', 'Errors', 'end')}
            {activity.latencyStatus !== 'error' && sortableHead('p95', 'p95', 'end')}
            {sortableHead('cost', 'Cost share')}
            {activity.showsScores && sortableHead('score', 'Eval', 'end')}
            {sortableHead('lastRun', 'Last run')}
          </>
        )}
      </DataList.Top>
      {rows.length === 0 ? (
        <DataList.NoMatch message="No agents match your search" />
      ) : (
        rows.map(row => (
          <DataList.RowLink key={row.id} to={paths.agentLink(row.id)} LinkComponent={Link}>
            <RosterNameCell name={row.name} meta={agentComposition(row.agent)} isIdle={!isAgentActive(row)} />
            {activity && row.activity && (
              <>
                <RosterRunsCell name={row.name} activity={row.activity} range={activity.range} errorNoun="failed" />
                <RosterErrorRateCell activity={row.activity} />
                {activity.latencyStatus !== 'error' && (
                  <RosterLatencyCell latency={row.latency} status={activity.latencyStatus} />
                )}
                <CostShareCell cost={row.cost} totalCost={activity.totalCost} />
                {activity.showsScores && (
                  <DataList.NumberCell
                    title={row.scores?.byScorer
                      .map(scorer => `${scorer.scorerName} ${scorer.average.toFixed(2)}`)
                      .join(' · ')}
                  >
                    {row.scores ? row.scores.average.toFixed(2) : ''}
                  </DataList.NumberCell>
                )}
                <RosterLastRunCell activity={row.activity} range={activity.range} nowMs={activity.nowMs} />
              </>
            )}
          </DataList.RowLink>
        ))
      )}
    </DataList>
  );
}

function CostShareCell({ cost, totalCost }: { cost: number | null; totalCost: number }) {
  if (cost === null) return <DataList.Cell />;
  const share = totalCost > 0 ? cost / totalCost : 0;
  return (
    <DataList.Cell>
      <span className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2">
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-fill-subtle">
          <span className="block h-full rounded-full bg-chart-purple" style={{ width: `${share * 100}%` }} />
        </span>
        <span className="text-right text-foreground tabular-nums">{formatUsd(cost)}</span>
      </span>
    </DataList.Cell>
  );
}
