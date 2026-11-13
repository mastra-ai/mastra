import { EntityType } from '@mastra/core/observability';
import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import {
  FilterBar,
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_FIELD_ID,
  FILTER_BAR_TIME_RANGE_ITEM,
} from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import type { PropertyFilterToken } from '@mastra/playground-ui/components/PropertyFilter';
import { Txt } from '@mastra/playground-ui/components/Txt';
import {
  AgentRunsCard,
  BreakdownCard,
  DistinctIdsCard,
  LatencyCard,
  MetricsGrid,
  ScoresCard,
  TokenUsageCard,
  TraceVolumeCard,
  UsageCard,
} from '@mastra/playground-ui/domains/metrics/components';
import { MetricsTimeRangeChip } from '@mastra/playground-ui/domains/metrics/components/metrics-time-range-chip';
import { buildLogsDrilldownUrl, buildTracesDrilldownUrl } from '@mastra/playground-ui/domains/metrics/drilldown';
import type { DrilldownScope } from '@mastra/playground-ui/domains/metrics/drilldown';
import { MetricsProvider, useMetrics } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import type { DatePreset, DateRange } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics';
import { useMetricsFilters } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics-filters';
import { useMetricsLayout } from '@mastra/playground-ui/domains/metrics/hooks/use-metrics-layout';
import {
  METRICS_FILTER_BAR_OPERATORS,
  createMetricsFilterBarFields,
  filterBarItemsToMetricsTokens,
  metricsTokensToFilterBarItems,
} from '@mastra/playground-ui/domains/metrics/metrics-filters';
import { useAgentRunsKpiMetrics } from '@mastra/react/hooks/metrics';
import { useEntityNames, useEnvironments, useServiceNames, useTags } from '@mastra/react/hooks/traces';
import { useState } from 'react';

/** Where a dashboard drilldown goes: the Studio URL's search params, which the traces and logs tabs read. */
export type Drilldown = { to: 'traces' | 'logs'; params: URLSearchParams };

/** What the dashboard opens on: the opening tool's time range and chips, and the filters it couldn't apply. */
export type MetricsOpening = { tokens: PropertyFilterToken[]; range?: DateRange; unapplied: string[] };

type MetricsProps = {
  onDrilldown: (drilldown: Drilldown) => void;
  /** Whether the Logs tab is there to drill into. */
  logs: boolean;
};

const isTimeRangeItem = (item: FilterBarItem) => item.fieldId === FILTER_BAR_TIME_RANGE_FIELD_ID;

function MetricsFilterBar({ fields }: { fields: FilterBarField[] }) {
  const { filterTokens, setFilterTokens } = useMetrics();
  const value = [FILTER_BAR_TIME_RANGE_ITEM, ...metricsTokensToFilterBarItems(filterTokens)];
  return (
    <FilterBar
      fields={[FILTER_BAR_TIME_RANGE_FIELD, ...fields]}
      operators={METRICS_FILTER_BAR_OPERATORS}
      value={value}
      onValueChange={(items: FilterBarItem[]) =>
        setFilterTokens(filterBarItemsToMetricsTokens(items.filter(item => !isTimeRangeItem(item))))
      }
      createItemId={fieldId => fieldId}
      aria-label="Metrics filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips
        renderChip={item => (isTimeRangeItem(item) ? <MetricsTimeRangeChip /> : <FilterBar.Chip item={item} />)}
      />
    </FilterBar>
  );
}

function MetricsCards({ onDrilldown, logs }: MetricsProps) {
  const { datePreset, customRange, dimensionalFilter } = useMetrics();
  const layout = useMetricsLayout();
  const base = { preset: datePreset, customRange, dashboardFilter: dimensionalFilter };
  const search = (url: string) => new URL(url, 'https://mcp-app.mastra.invalid').searchParams;
  const openTraces = (scope: DrilldownScope = {}) =>
    onDrilldown({ to: 'traces', params: search(buildTracesDrilldownUrl({ ...base, scope })) });
  // Without the Logs tab, the cards leave out their "open errors in logs" actions.
  const openLogs = logs
    ? (scope: DrilldownScope = {}) =>
        onDrilldown({ to: 'logs', params: search(buildLogsDrilldownUrl({ ...base, scope })) })
    : undefined;
  const agent = EntityType.AGENT;

  const agentRuns = (
    <AgentRunsCard
      onTimeRangeClick={range => openTraces({ rootEntityType: agent, window: range })}
      onViewErrors={openLogs && (() => openLogs({ rootEntityType: agent, status: 'error' }))}
      onFailureTimeRangeClick={range => openTraces({ rootEntityType: agent, status: 'error', window: range })}
    />
  );
  const latency = (
    <LatencyCard
      onViewTraces={rootEntityType => openTraces({ rootEntityType })}
      onTimeRangeClick={range => openTraces({ window: range })}
    />
  );
  const tokenUsage = (
    <TokenUsageCard onViewTraces={() => openTraces()} onTimeRangeClick={range => openTraces({ window: range })} />
  );

  if (layout === 'unified') {
    return (
      <div className="grid content-start gap-4 pb-6">
        <MetricsGrid columns={2}>
          <MetricsGrid.Item>{tokenUsage}</MetricsGrid.Item>
          <MetricsGrid.Item>{agentRuns}</MetricsGrid.Item>
          <MetricsGrid.Item>{latency}</MetricsGrid.Item>
          <MetricsGrid.Item>
            <DistinctIdsCard onTimeRangeClick={openTraces} />
          </MetricsGrid.Item>
        </MetricsGrid>
        <BreakdownCard onRowClick={openTraces} />
      </div>
    );
  }
  return (
    <div className="grid content-start gap-4 pb-6">
      {tokenUsage}
      <MetricsGrid columns={2}>
        <MetricsGrid.Item>{agentRuns}</MetricsGrid.Item>
        <MetricsGrid.Item>{latency}</MetricsGrid.Item>
      </MetricsGrid>
      <MetricsGrid columns={2}>
        <MetricsGrid.Item>
          <TraceVolumeCard
            onViewTraces={rootEntityType => openTraces({ rootEntityType })}
            onViewErrors={openLogs && (rootEntityType => openLogs({ rootEntityType, status: 'error' }))}
            onEntityClick={(rootEntityType, entityName) => openTraces({ rootEntityType, entityName })}
          />
        </MetricsGrid.Item>
        <MetricsGrid.Item>
          <UsageCard
            onViewTraces={() => openTraces()}
            onAgentClick={entityName => openTraces({ rootEntityType: agent, entityName })}
            onModelClick={model => openTraces({ model })}
            onThreadClick={threadId => openTraces({ threadId })}
          />
        </MetricsGrid.Item>
      </MetricsGrid>
      <ScoresCard />
    </div>
  );
}

function MetricsContent({ unapplied, ...props }: MetricsProps & { unapplied: string[] }) {
  const { error } = useAgentRunsKpiMetrics(useMetricsFilters());
  const { data: tags } = useTags();
  const { data: entityNames } = useEntityNames();
  const { data: serviceNames } = useServiceNames();
  const { data: environments } = useEnvironments();
  const fields = createMetricsFilterBarFields({
    availableTags: tags ?? [],
    availableEntityNames: entityNames ?? [],
    availableServiceNames: serviceNames ?? [],
    availableEnvironments: environments ?? [],
  });

  return (
    <div className="flex flex-col gap-3 p-3">
      <ActionRow>
        <ActionRow.Start>
          <MetricsFilterBar fields={fields} />
        </ActionRow.Start>
      </ActionRow>
      {unapplied.length > 0 && (
        <Txt variant="body-sm" tone="muted">
          The conversation also filtered by {unapplied.join(', ')}, which the dashboard can't apply. Its numbers include
          everything those filters left out.
        </Txt>
      )}
      {error ? (
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load metrics" descriptionSlot={error.message} />
      ) : (
        <MetricsCards {...props} />
      )}
    </div>
  );
}

/**
 * Studio's metrics dashboard. Its drilldowns (a chart's time range, an entity, errors) open the traces or logs
 * tab with the same filters Studio would put in their URL. Filters aren't saved between visits, since hosts
 * sandbox apps away from storage.
 */
export function MetricsTab({ opening, ...props }: MetricsProps & { opening?: MetricsOpening }) {
  const [preset, setPreset] = useState<DatePreset>(opening?.range ? 'custom' : '24h');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(opening?.range);
  const [filterTokens, setFilterTokens] = useState<PropertyFilterToken[]>(opening?.tokens ?? []);
  return (
    <MetricsProvider
      preset={preset}
      filterTokens={filterTokens}
      onPresetChange={next => {
        setPreset(next);
        if (next !== 'custom') setCustomRange(undefined);
      }}
      onFilterTokensChange={setFilterTokens}
      customRange={customRange}
      onCustomRangeChange={setCustomRange}
    >
      <MetricsContent {...props} unapplied={opening?.unapplied ?? []} />
    </MetricsProvider>
  );
}
