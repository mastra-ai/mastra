import type { DatasetExperiment } from '@mastra/client-js';
import { MetricsCardGroup } from '@mastra/playground-ui/components/MetricsCardGroup';
import { KpiCard } from '@mastra/playground-ui/domains/metrics/components';
import { formatCompactNumber, formatCost } from '@mastra/playground-ui/utils/cost';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { useScoresByExperimentId } from '@mastra/react/hooks/datasets';
import type { ExperimentMetrics } from '@mastra/react/hooks/experiments';
import { CoinsIcon, GaugeIcon, ListChecksIcon, TimerIcon, ZapIcon } from 'lucide-react';
import { useMemo } from 'react';

export interface ExperimentKpisProps {
  experiment: DatasetExperiment;
  metrics?: {
    data?: ExperimentMetrics;
    isLoading: boolean;
    isEnabled: boolean;
  };
}

/** Headline numbers for a run, shown above its results like the Metrics page KPIs. */
export function ExperimentKpis({ experiment, metrics }: ExperimentKpisProps) {
  const { data: scoresByItemId } = useScoresByExperimentId({
    experimentId: experiment.id,
    experimentStatus: experiment.status,
    queryOptions: { enabled: Boolean(experiment.id) },
  });
  const isActive = experiment.status === 'running' || experiment.status === 'pending';

  // Averages every score fetched so far, so a running experiment reflects only the items scored up to now.
  const avgScore = useMemo(() => {
    if (!scoresByItemId) return undefined;
    const scores = Object.values(scoresByItemId).flat();
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
  }, [scoresByItemId]);

  const processed = (experiment.succeededCount ?? 0) + (experiment.failedCount ?? 0);
  const failed = experiment.failedCount ?? 0;

  const startedAt = experiment.startedAt ?? experiment.createdAt;
  const duration = (() => {
    if (isActive) return 'Running…';
    if (!experiment.startedAt || !experiment.completedAt) return '—';
    const ms = new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime();
    return formatDuration(ms) ?? '—';
  })();

  const soFar = isActive ? ' so far' : '';
  const tokens = metrics?.data?.totalTokens;
  const cost = metrics?.data?.estimatedCost;
  const latency = metrics?.data?.avgAgentDurationMs;

  return (
    <MetricsCardGroup>
      <KpiCard
        label="Avg score"
        icon={GaugeIcon}
        value={avgScore == null ? '—' : avgScore.toFixed(3)}
        detail={avgScore != null ? `across all scorers${soFar}` : isActive ? 'waiting for scores' : 'no scores'}
        isLoading={avgScore === undefined && !isActive}
      />
      <KpiCard
        label="Items"
        icon={ListChecksIcon}
        value={isActive ? `${processed}/${experiment.totalItems}` : String(experiment.totalItems)}
        detail={isActive ? 'processed so far' : failed > 0 ? `${failed} errored` : 'all processed'}
      />
      <KpiCard
        label="Duration"
        icon={TimerIcon}
        value={duration}
        detail={startedAt ? `started ${formatDate(new Date(startedAt), 'date-time')}` : 'not started'}
      />
      {metrics?.isEnabled && (
        <>
          <KpiCard
            label="Tokens"
            icon={CoinsIcon}
            value={tokens == null ? '—' : formatCompactNumber(tokens)}
            detail={cost == null ? `total${soFar}` : `${formatCost(cost, metrics.data?.costUnit)}${soFar}`}
            isLoading={metrics.isLoading}
          />
          <KpiCard
            label="Latency (avg)"
            icon={ZapIcon}
            value={latency == null ? '—' : (formatDuration(Math.round(latency)) ?? '—')}
            detail="per agent run"
            isLoading={metrics.isLoading}
          />
        </>
      )}
    </MetricsCardGroup>
  );
}
