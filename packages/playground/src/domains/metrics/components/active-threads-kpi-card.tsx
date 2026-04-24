import { MetricsKpiCard } from '@mastra/playground-ui';
import { useActiveThreadsKpiMetrics } from '../hooks/use-active-threads-kpi-metrics';
import { formatCompact } from './metrics-utils';

export function ActiveThreadsKpiCard() {
  const { data, isLoading, isError } = useActiveThreadsKpiMetrics();
  const hasData = data?.value != null;

  return (
    <MetricsKpiCard>
      <MetricsKpiCard.Label>Active Threads</MetricsKpiCard.Label>
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
