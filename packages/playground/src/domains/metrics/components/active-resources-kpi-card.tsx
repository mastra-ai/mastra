import { MetricsKpiCard } from '@mastra/playground-ui';
import { useActiveResourcesKpiMetrics } from '../hooks/use-active-resources-kpi-metrics';
import { formatCompact } from './metrics-utils';

export function ActiveResourcesKpiCard() {
  const { data, isLoading, isError } = useActiveResourcesKpiMetrics();
  const hasData = data?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Active Resources</MetricsKpiCard.Label>
      <MetricsKpiCard.Value className={hasData ? undefined : 'invisible'}>
        {hasData ? formatCompact(data.value!) : '—'}
      </MetricsKpiCard.Value>
      {isError ? (
        <MetricsKpiCard.Error />
      ) : isLoading ? (
        <MetricsKpiCard.Loading />
      ) : hasData ? (
        data.changePercent != null ? (
          <MetricsKpiCard.Change
            changePct={data.changePercent}
            prevValue={data.previousValue != null ? formatCompact(data.previousValue) : undefined}
          />
        ) : (
          <MetricsKpiCard.NoChange />
        )
      ) : (
        <MetricsKpiCard.NoData />
      )}
    </MetricsKpiCard>
  );
}
