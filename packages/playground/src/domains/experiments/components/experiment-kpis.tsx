import type { DatasetExperiment } from '@mastra/client-js';
import { MetricsCardGroup } from '@mastra/playground-ui/components/MetricsCardGroup';
import { KpiCard } from '@mastra/playground-ui/domains/metrics/components';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { useScoresByExperimentId } from '@mastra/react/hooks/datasets';
import { useExperimentsItemUsage } from '@mastra/react/hooks/experiments';
import type { ExperimentMetrics } from '@mastra/react/hooks/experiments';
import { CoinsIcon, GaugeIcon, HashIcon, TimerIcon } from 'lucide-react';
import { useMemo } from 'react';
import { formatCostValue, formatTokenCount, totalTokens } from './comparison/comparison-metric-format';

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
  const experimentRefs = useMemo(
    () => [{ id: experiment.id, status: experiment.status }],
    [experiment.id, experiment.status],
  );
  const { data: usageById, isLoading: isUsageLoading } = useExperimentsItemUsage({
    experiments: experimentRefs,
    supportsMetrics: metrics?.isEnabled ?? false,
  });

  // Averages every score fetched so far, so a running experiment reflects only the items scored up to now.
  const avgScore = useMemo(() => {
    if (!scoresByItemId) return undefined;
    const scores = Object.values(scoresByItemId).flat();
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
  }, [scoresByItemId]);

  const startedAt = experiment.startedAt ?? experiment.createdAt;
  const duration = (() => {
    if (isActive) return 'Running…';
    if (!experiment.startedAt || !experiment.completedAt) return '—';
    const ms = new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime();
    return formatDuration(ms) ?? '—';
  })();

  const soFar = isActive ? ' so far' : '';
  // Same per-item breakdown as the results rows (shared query), so the totals match the rows and split input/output.
  const usage = usageById[experiment.id]?.summary;
  const tokens = totalTokens(usage);
  const tokensDetail =
    usage?.inputTokens === undefined && usage?.outputTokens === undefined
      ? `input + output${soFar}`
      : `${formatTokenCount(usage.inputTokens ?? 0)} in · ${formatTokenCount(usage.outputTokens ?? 0)} out${soFar}`;
  const avgItemDuration = metrics?.isEnabled ? metrics.data?.avgAgentDurationMs : undefined;
  const formattedAvgItemDuration = avgItemDuration == null ? undefined : formatDuration(Math.round(avgItemDuration));

  const runDurationDetail = (() => {
    if (formattedAvgItemDuration) return `${formattedAvgItemDuration} avg per item${soFar}`;
    return startedAt ? `started ${formatDate(new Date(startedAt), 'date-time')}` : 'not started';
  })();

  return (
    <MetricsCardGroup>
      {metrics?.isEnabled && (
        <KpiCard
          label="Total cost"
          icon={CoinsIcon}
          value={usage?.estimatedCost === undefined ? '—' : formatCostValue(usage.estimatedCost, usage.costUnit)}
          detail={`estimated${soFar}`}
          isLoading={isUsageLoading}
        />
      )}
      <KpiCard label="Run duration" icon={TimerIcon} value={duration} detail={runDurationDetail} />
      {metrics?.isEnabled && (
        <KpiCard
          label="Total tokens"
          icon={HashIcon}
          value={tokens === undefined ? '—' : formatTokenCount(tokens)}
          detail={tokensDetail}
          isLoading={isUsageLoading}
        />
      )}
      <KpiCard
        label="Avg score"
        icon={GaugeIcon}
        value={avgScore == null ? '—' : avgScore.toFixed(3)}
        detail={avgScore != null ? `across all scorers${soFar}` : isActive ? 'waiting for scores' : 'no scores'}
        isLoading={avgScore === undefined && !isActive}
      />
    </MetricsCardGroup>
  );
}
