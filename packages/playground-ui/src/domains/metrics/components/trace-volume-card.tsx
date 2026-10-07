import { EntityType } from '@mastra/core/observability';
import { useTraceVolumeMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount, formatPercent } from '../lib/chart-format';
import { OpenErrorsInLogsButton, OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsShareListRow } from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';

type Entity = 'agents' | 'workflows' | 'tools';

const ROOT_ENTITY: Record<Entity, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};
const COLUMNS = [{ label: 'Error rate' }];

const errorRate = (errors: number, runs: number) => formatPercent(runs > 0 ? errors / runs : 0);

/** Runs per agent, workflow or tool, ranked, with each one's error rate; a row opens its traces. */
export type TraceVolumeCardProps = {
  /** Called from the "View in Traces" button with the entity type of the open tab. */
  onViewTraces?: (entityType: EntityType) => void;
  /** Called from the "View errors in Logs" button with the entity type of the open tab. */
  onViewErrors?: (entityType: EntityType) => void;
  /** Called with the entity type of the open tab and the clicked row's name. */
  onEntityClick?: (entityType: EntityType, name: string) => void;
};

export function TraceVolumeCard({ onViewTraces, onViewErrors, onEntityClick }: TraceVolumeCardProps) {
  const [entity, setEntity] = useState<Entity>('agents');
  const rootEntityType = ROOT_ENTITY[entity];
  const volume = useTraceVolumeMetrics({
    ...useMetricsFilters(),
    queryOptions: { placeholderData: keepPreviousData },
  });
  const byEntity = {
    agents: volume.data?.agentData ?? [],
    workflows: volume.data?.workflowData ?? [],
    tools: volume.data?.toolData ?? [],
  };
  const source = byEntity[entity];
  const rows: MetricsShareListRow[] = source.map(r => ({
    key: r.name,
    label: r.name,
    share: r.completed + r.errors,
    value: formatCount(r.completed + r.errors),
    cells: [errorRate(r.errors, r.completed + r.errors)],
    onClick: onEntityClick && (() => onEntityClick(rootEntityType, r.name)),
  }));
  const errorsOf = new Map(source.map(r => [r.name, r.errors]));
  const total = [...byEntity.agents, ...byEntity.workflows, ...byEntity.tools].reduce(
    (sum, r) => sum + r.completed + r.errors,
    0,
  );

  const layout = {
    title: 'Trace volume',
    description: 'Runs and calls, with error rate.',
    actions: (onViewTraces || onViewErrors) && (
      <>
        {onViewTraces && <OpenInTracesButton onClick={() => onViewTraces(rootEntityType)} />}
        {onViewErrors && <OpenErrorsInLogsButton onClick={() => onViewErrors(rootEntityType)} />}
      </>
    ),
  };
  const tabs = (
    <MetricsCard.Tabs<Entity> value={entity} onValueChange={setEntity}>
      <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
      <MetricsCard.Tab value="workflows">Workflows</MetricsCard.Tab>
      <MetricsCard.Tab value="tools">Tools</MetricsCard.Tab>
    </MetricsCard.Tabs>
  );

  // Without rows, the column header would label nothing; the tabs stay to try another entity.
  if (volume.isError) {
    return (
      <ChartCard {...layout} toolbar={<MetricsCard.Toolbar>{tabs}</MetricsCard.Toolbar>}>
        <ChartCardError />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      {...layout}
      toolbar={
        <MetricsCard.Toolbar>
          {tabs}
          <MetricsShareList.Header columns={COLUMNS} valueLabel="Runs" />
        </MetricsCard.Toolbar>
      }
      summary={<MetricsCard.Summary value={formatCount(total)} label="runs and calls" isLoading={volume.isLoading} />}
      isUpdating={volume.isPlaceholderData}
    >
      <ChartArea>
        <MetricsShareList
          key={entity}
          rows={rows}
          columns={COLUMNS}
          valueLabel="Runs"
          showHeader={false}
          color={CHART_COLORS.sky}
          other={rest => {
            const errors = rest.reduce((sum, r) => sum + (errorsOf.get(r.key) ?? 0), 0);
            const runs = rest.reduce((sum, r) => sum + r.share, 0);
            return { value: formatCount(runs), cells: [errorRate(errors, runs)] };
          }}
          emptyState="No runs in this range."
          isLoading={volume.isLoading}
        />
      </ChartArea>
    </ChartCard>
  );
}
