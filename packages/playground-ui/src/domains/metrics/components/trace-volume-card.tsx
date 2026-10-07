import { EntityType } from '@mastra/core/observability';
import { useTraceVolumeMetrics } from '@mastra/react/hooks/metrics';
import { keepPreviousData } from '@tanstack/react-query';
import { useState } from 'react';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount, formatPercent } from '../lib/chart-format';
import { OpenErrorsInLogsButton, OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsShareListRow } from '@/ds/components/MetricsShareList';
import { MetricsShareList } from '@/ds/components/MetricsShareList';
import { useLinkComponent } from '@/lib/framework';

type Entity = 'agents' | 'workflows' | 'tools';

const ROOT_ENTITY: Record<Entity, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};
const COLUMNS = [{ label: 'Error rate' }];

const errorRate = (errors: number, runs: number) => formatPercent(runs > 0 ? errors / runs : 0);

/** Runs per agent, workflow or tool, ranked, with each one's error rate; a row opens its traces. */
export function TraceVolumeCard() {
  const { Link } = useLinkComponent();
  const [entity, setEntity] = useState<Entity>('agents');
  const { getTracesHref, getLogsHref } = useDrilldown();
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
    href: getTracesHref({ rootEntityType: ROOT_ENTITY[entity], entityName: r.name }),
  }));
  const errorsOf = new Map(source.map(r => [r.name, r.errors]));
  const total = [...byEntity.agents, ...byEntity.workflows, ...byEntity.tools].reduce(
    (sum, r) => sum + r.completed + r.errors,
    0,
  );

  return (
    <ChartCard
      title="Trace volume"
      description="Runs and calls, with error rate."
      summary={{ value: formatCount(total), label: 'runs and calls' }}
      actions={
        <>
          <OpenInTracesButton href={getTracesHref({ rootEntityType: ROOT_ENTITY[entity] })} LinkComponent={Link} />
          <OpenErrorsInLogsButton
            href={getLogsHref({ rootEntityType: ROOT_ENTITY[entity], status: 'error' })}
            LinkComponent={Link}
          />
        </>
      }
      isLoading={volume.isLoading}
      isUpdating={volume.isPlaceholderData}
      isError={volume.isError}
    >
      <MetricsCard.Toolbar>
        <MetricsCard.Tabs<Entity> value={entity} onValueChange={setEntity}>
          <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
          <MetricsCard.Tab value="workflows">Workflows</MetricsCard.Tab>
          <MetricsCard.Tab value="tools">Tools</MetricsCard.Tab>
        </MetricsCard.Tabs>
        <MetricsShareList.Header columns={COLUMNS} valueLabel="Runs" />
      </MetricsCard.Toolbar>
      <ChartArea isError={volume.isError}>
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
          LinkComponent={Link}
          isLoading={volume.isLoading}
        />
      </ChartArea>
    </ChartCard>
  );
}
