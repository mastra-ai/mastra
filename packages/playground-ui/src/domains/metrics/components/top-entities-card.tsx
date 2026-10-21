import type { AggregateTracesArgs } from '@mastra/client-js';
import { EntityType } from '@mastra/core/observability';
import type { TraceQueryPredicate } from '@mastra/core/storage';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsTraceAggregate } from '../hooks/use-metrics-trace-aggregate';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { formatCount, formatDuration, formatPercent } from '../lib/chart-format';
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

type View = 'slowest' | 'failing' | 'expensive';

/** Entities ranked client-side; the request takes the busiest ones, so every tab ranks the same set. */
export const TOP_ENTITIES_REQUEST_LIMIT = 500;
export const TOP_ENTITIES_SHOWN = 20;

const MEASURES: AggregateTracesArgs['measures'] = ['count', 'errorRate', 'errorCount', 'duration.p95', 'cost.sum'];

/** Scorer runs are evaluations, not agents or workflows; in some projects they start most traces. */
const NOT_SCORER: TraceQueryPredicate = { op: 'notIn', value: { path: 'entityType' }, set: [EntityType.SCORER] };

const ENTITY_TYPES = new Set<string>(Object.values(EntityType));
const isEntityType = (value: string): value is EntityType => ENTITY_TYPES.has(value);

/** A grouped row with the API's nulls read as absent. */
type Entity = {
  key: string;
  type?: EntityType;
  name?: string;
  count: number;
  errorCount: number;
  errorRate?: number;
  p95?: number;
  cost: AggregateCost;
};

function toEntity(row: TraceAggregateRow): Entity {
  const type = row.dimensions?.entityType ?? undefined;
  const name = row.dimensions?.entityName ?? undefined;
  return {
    key: `${type}:${name}`,
    type: type !== undefined && isEntityType(type) ? type : undefined,
    name,
    count: row.measures['count'] ?? 0,
    errorCount: row.measures['errorCount'] ?? 0,
    errorRate: row.measures['errorRate'] ?? undefined,
    p95: row.measures['duration.p95'] ?? undefined,
    cost: traceAggregateRowCost(row),
  };
}

const TITLE = 'Top entities';
const DESCRIPTION = 'Agents and workflows whose traces were slowest, failed most or cost most.';

export type TopEntitiesCardProps = {
  /** Called with the root type and name of the clicked entity. */
  onEntityClick?: (scope: DrilldownScope) => void;
};

/** The 20 slowest, most failing or most expensive entities, from one grouped request. */
export function TopEntitiesCard(props: TopEntitiesCardProps) {
  return (
    <TraceAggregateCard title={TITLE} description={DESCRIPTION}>
      {scope => <TopEntitiesList scope={scope} {...props} />}
    </TraceAggregateCard>
  );
}

function TopEntitiesList({ scope, onEntityClick }: TopEntitiesCardProps & { scope: TraceAggregateScope }) {
  const [view, setView] = useState<View>('slowest');
  const { data, isLoading, isPlaceholderData, error, refetch } = useMetricsTraceAggregate({
    timeRange: scope.timeRange,
    where: scope.where ? { op: 'and', args: [scope.where, NOT_SCORER] } : NOT_SCORER,
    groupBy: ['entityType', 'entityName'],
    measures: MEASURES,
    orderBy: { field: 'count', direction: 'desc' },
    limit: TOP_ENTITIES_REQUEST_LIMIT,
  });

  const layout = {
    title: TITLE,
    description: DESCRIPTION,
    toolbar: (
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<View> value={view} onValueChange={setView}>
          <MetricsCard.Tab value="slowest">Slowest</MetricsCard.Tab>
          <MetricsCard.Tab value="failing">Most failing</MetricsCard.Tab>
          <MetricsCard.Tab value="expensive">Most expensive</MetricsCard.Tab>
        </MetricsCard.Tabs>
      </MetricsCard.Toolbar>
    ),
  };

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

  const entities = (data?.rows ?? []).map(toEntity);
  return (
    <ChartCard {...layout} isUpdating={isPlaceholderData}>
      {view === 'slowest' && <SlowestEntities entities={entities} onEntityClick={onEntityClick} />}
      {view === 'failing' && <FailingEntities entities={entities} onEntityClick={onEntityClick} />}
      {view === 'expensive' && <ExpensiveEntities entities={entities} onEntityClick={onEntityClick} />}
      {data?.truncated && (
        <Txt variant="caption" tone="faint" className="pt-2">
          Ranked from the {TOP_ENTITIES_REQUEST_LIMIT} entities with the most traces.
        </Txt>
      )}
    </ChartCard>
  );
}

type RankedProps = { entities: Entity[]; onEntityClick?: (scope: DrilldownScope) => void };

function SlowestEntities({ entities, onEntityClick }: RankedProps) {
  const ranked = entities
    .filter(e => e.p95 !== undefined)
    .toSorted((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0))
    .slice(0, TOP_ENTITIES_SHOWN);
  if (ranked.length === 0) return <MetricsCard.NoData message="No traces in this range." />;
  return (
    <EntityTable
      label="slowest"
      heads={
        <>
          <Table.Head align="end">Traces</Table.Head>
          <Table.Head align="end">P95</Table.Head>
        </>
      }
    >
      {ranked.map(e => (
        <EntityRow key={e.key} entity={e} onEntityClick={onEntityClick}>
          <NumberCell>{formatCount(e.count)}</NumberCell>
          <NumberCell>{formatDuration(e.p95 ?? 0)}</NumberCell>
        </EntityRow>
      ))}
    </EntityTable>
  );
}

function FailingEntities({ entities, onEntityClick }: RankedProps) {
  const ranked = entities
    .filter(e => e.errorCount > 0)
    .toSorted((a, b) => (b.errorRate ?? 0) - (a.errorRate ?? 0) || b.errorCount - a.errorCount)
    .slice(0, TOP_ENTITIES_SHOWN);
  if (ranked.length === 0) return <MetricsCard.NoData message="No failed traces in this range." />;
  return (
    <EntityTable
      label="failing"
      heads={
        <>
          <Table.Head align="end">Traces</Table.Head>
          <Table.Head align="end">Errors</Table.Head>
          <Table.Head align="end">Error rate</Table.Head>
        </>
      }
    >
      {ranked.map(e => (
        <EntityRow key={e.key} entity={e} onEntityClick={onEntityClick}>
          <NumberCell>{formatCount(e.count)}</NumberCell>
          <NumberCell>{formatCount(e.errorCount)}</NumberCell>
          <NumberCell>{formatPercent(e.errorRate ?? 0)}</NumberCell>
        </EntityRow>
      ))}
    </EntityTable>
  );
}

const isMixed = (e: Entity) => Number(e.cost.unit === 'mixed');

function ExpensiveEntities({ entities, onEntityClick }: RankedProps) {
  // A total in more than one currency has no single value to rank, so it goes last.
  const ranked = entities
    .filter(e => e.cost.value !== undefined || e.cost.unit === 'mixed')
    .toSorted((a, b) => isMixed(a) - isMixed(b) || (b.cost.value ?? 0) - (a.cost.value ?? 0))
    .slice(0, TOP_ENTITIES_SHOWN);
  if (ranked.length === 0) return <MetricsCard.NoData message="No priced traces in this range." />;
  return (
    <EntityTable
      label="expensive"
      heads={
        <>
          <Table.Head align="end">Traces</Table.Head>
          <Table.Head align="end">Cost</Table.Head>
        </>
      }
    >
      {ranked.map(e => (
        <EntityRow key={e.key} entity={e} onEntityClick={onEntityClick}>
          <NumberCell>{formatCount(e.count)}</NumberCell>
          <CostCell cost={e.cost} />
        </EntityRow>
      ))}
    </EntityTable>
  );
}

/** The ranked table: an entity column, then the view's number columns. */
function EntityTable({ label, heads, children }: { label: string; heads: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Table variant="inset" aria-label={`${TITLE}: ${label}`}>
        <Table.Header>
          <Table.Row>
            <Table.Head className="w-full">Entity</Table.Head>
            {heads}
          </Table.Row>
        </Table.Header>
        <Table.Body>{children}</Table.Body>
      </Table>
    </div>
  );
}

function EntityRow({
  entity,
  onEntityClick,
  children,
}: {
  entity: Entity;
  onEntityClick?: (scope: DrilldownScope) => void;
  children: ReactNode;
}) {
  const { name, type } = entity;
  const label = <EntityLabel name={name ?? '(not set)'} type={type} />;
  return (
    <Table.Row>
      <Table.Cell>
        {onEntityClick && name ? (
          <Table.RowButton onClick={() => onEntityClick({ rootEntityType: type, entityName: name })}>
            {label}
          </Table.RowButton>
        ) : (
          label
        )}
      </Table.Cell>
      {children}
    </Table.Row>
  );
}

function EntityLabel({ name, type }: { name: string; type?: EntityType }) {
  return (
    <span className="flex max-w-64 min-w-0 items-baseline gap-2" title={name}>
      <Txt as="span" variant="body-sm" tone="ink" className="truncate">
        {name}
      </Txt>
      {type && (
        <Txt as="span" variant="body-sm" tone="faint" className="shrink-0">
          {type}
        </Txt>
      )}
    </span>
  );
}

function NumberCell({ children }: { children: ReactNode }) {
  return (
    <Table.Cell align="end" tone="muted">
      {children}
    </Table.Cell>
  );
}

function CostCell({ cost }: { cost: AggregateCost }) {
  const { text, tooltip } = formatAggregateCost(cost);
  return (
    <Table.Cell align="end" tone="muted" title={tooltip}>
      {text}
    </Table.Cell>
  );
}
