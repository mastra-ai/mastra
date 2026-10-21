import type { AggregateTracesArgs } from '@mastra/client-js';
import type { ReactNode } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsTraceAggregate } from '../hooks/use-metrics-trace-aggregate';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { formatCount, formatPercent } from '../lib/chart-format';
import { traceAggregateRowCost } from '../lib/trace-aggregate';
import type { TraceAggregateRow } from '../lib/trace-aggregate';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { TraceAggregateCard } from './trace-aggregate-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { Table } from '@/ds/components/Table';
import { Txt } from '@/ds/components/Txt';
import { formatAggregateCost } from '@/lib/cost';
import type { AggregateCost } from '@/lib/cost';

/** Environments are few; this keeps the list bounded if a store has many. */
export const TRACE_BREAKDOWN_LIMIT = 50;

const MEASURES: AggregateTracesArgs['measures'] = ['count', 'errorRate', 'cost.sum'];

const TITLE = 'Trace breakdown';
const DESCRIPTION = 'Trace count, error rate and cost per environment.';

/** A grouped row with the API's nulls read as absent. */
type Group = { value?: string; count: number; errorRate: number; cost: AggregateCost };

const toGroup = (row: TraceAggregateRow): Group => ({
  value: row.dimensions?.['environment'] ?? undefined,
  count: row.measures['count'] ?? 0,
  errorRate: row.measures['errorRate'] ?? 0,
  cost: traceAggregateRowCost(row),
});

export type TraceBreakdownCardProps = {
  /** Called with the clicked environment. */
  onEnvironmentClick?: (scope: DrilldownScope) => void;
};

/** Traces split by environment, in one request. */
export function TraceBreakdownCard(props: TraceBreakdownCardProps) {
  return (
    <TraceAggregateCard title={TITLE} description={DESCRIPTION}>
      {scope => <TraceBreakdownList scope={scope} {...props} />}
    </TraceAggregateCard>
  );
}

function TraceBreakdownList({ scope, onEnvironmentClick }: TraceBreakdownCardProps & { scope: TraceAggregateScope }) {
  const { data, isLoading, isPlaceholderData, error, refetch } = useMetricsTraceAggregate({
    timeRange: scope.timeRange,
    where: scope.where,
    groupBy: ['environment'],
    measures: MEASURES,
    orderBy: { field: 'count', direction: 'desc' },
    limit: TRACE_BREAKDOWN_LIMIT,
  });

  const layout = { title: TITLE, description: DESCRIPTION };

  if (error) {
    return (
      <ChartCard {...layout}>
        <ChartCardError error={error} onRetry={() => void refetch()} />
      </ChartCard>
    );
  }

  if (isLoading) {
    return (
      <ChartCard {...layout}>
        <MetricsCard.Loading />
      </ChartCard>
    );
  }

  const groups = (data?.rows ?? []).map(toGroup);
  return (
    <ChartCard {...layout} isUpdating={isPlaceholderData}>
      {groups.length === 0 ? (
        <MetricsCard.NoData message="No traces in this range." />
      ) : (
        <BreakdownTable>
          {groups.map(group => (
            <BreakdownRow key={group.value ?? ''} group={group} onClick={onEnvironmentClick} />
          ))}
        </BreakdownTable>
      )}
      {data?.truncated && (
        <Txt variant="caption" tone="faint" className="pt-2">
          Showing the {TRACE_BREAKDOWN_LIMIT} with the most traces.
        </Txt>
      )}
    </ChartCard>
  );
}

function BreakdownTable({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Table variant="inset" aria-label={TITLE}>
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-full">Environment</Table.Head>
            <Table.Head align="end">Traces</Table.Head>
            <Table.Head align="end">Error rate</Table.Head>
            <Table.Head align="end">Cost</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>{children}</Table.Body>
      </Table>
    </div>
  );
}

function BreakdownRow({ group, onClick }: { group: Group; onClick?: (scope: DrilldownScope) => void }) {
  const { value } = group;
  const label = <GroupLabel label={value ?? '(not set)'} />;
  const cost = formatAggregateCost(group.cost);
  return (
    <Table.Row>
      <Table.Cell>
        {onClick && value ? (
          <Table.RowButton onClick={() => onClick({ environment: value })}>{label}</Table.RowButton>
        ) : (
          label
        )}
      </Table.Cell>
      <Table.Cell align="end" tone="muted">
        {formatCount(group.count)}
      </Table.Cell>
      <Table.Cell align="end" tone="muted">
        {formatPercent(group.errorRate)}
      </Table.Cell>
      <Table.Cell align="end" tone="muted" title={cost.tooltip}>
        {cost.text}
      </Table.Cell>
    </Table.Row>
  );
}

function GroupLabel({ label }: { label: string }) {
  return (
    <Txt as="span" variant="body-sm" tone="ink" className="block max-w-64 truncate" title={label}>
      {label}
    </Txt>
  );
}
