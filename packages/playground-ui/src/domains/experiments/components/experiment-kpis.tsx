import type { ClientScoreRowData, DatasetExperiment } from '@mastra/client-js';
import type { ExperimentItemUsage, ExperimentMetrics } from '@mastra/react/hooks/experiments';
import { useMemo } from 'react';
import { formatCostValue, formatTokenCount, totalTokens } from './comparison/comparison-metric-format';
import { KpiCard } from '@/domains/metrics/components';
import { Metadata } from '@/ds/components/Metadata';
import { MetricsCardGroup } from '@/ds/components/MetricsCardGroup';
import { IconCoins } from '@/ds/icons/central/IconCoins';
import { IconGauge } from '@/ds/icons/central/IconGauge';
import { IconHashtag } from '@/ds/icons/central/IconHashtag';
import { IconStopwatch } from '@/ds/icons/central/IconStopwatch';
import { formatDate } from '@/utils/date-format';
import { formatDuration } from '@/utils/duration';

export interface ExperimentKpisProps {
  experiment: DatasetExperiment;
  metrics?: {
    data?: ExperimentMetrics;
    isLoading: boolean;
    isEnabled: boolean;
  };
  /** Scores of the run grouped by item id; undefined while loading. */
  scoresByItemId?: Record<string, Array<Pick<ClientScoreRowData, 'score'>>>;
  /** Usage totals of the run; shown when `metrics.isEnabled`. */
  usage?: ExperimentItemUsage;
  isUsageLoading?: boolean;
}

/** Headline numbers for a run, shown above its results like the Metrics page KPIs. */
export function ExperimentKpis({
  experiment,
  metrics,
  scoresByItemId,
  usage,
  isUsageLoading: isUsageQueryLoading = false,
}: ExperimentKpisProps) {
  // Usage is only fetched once the run finishes, so an in-progress run reads as loading rather than empty.
  const isUsageLoading = experiment.status === 'running' || experiment.status === 'pending' || isUsageQueryLoading;

  // Averages every score of the run, across all scorers.
  const avgScore = useMemo(() => {
    if (!scoresByItemId) return undefined;
    const scores = Object.values(scoresByItemId).flat();
    if (scores.length === 0) return null;
    return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
  }, [scoresByItemId]);

  const startedAt = experiment.startedAt ?? experiment.createdAt;
  const duration = (() => {
    if (!experiment.startedAt || !experiment.completedAt) return '—';
    const ms = new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime();
    return formatDuration(ms) ?? '—';
  })();

  // Same per-item breakdown as the results rows (shared query), so the totals match the rows and split input/output.
  const tokens = totalTokens(usage);
  const tokensDetail =
    usage?.inputTokens === undefined && usage?.outputTokens === undefined ? (
      'input + output'
    ) : (
      <Metadata singleLine>
        <Metadata.Item>{formatTokenCount(usage.inputTokens ?? 0)} in</Metadata.Item>
        <Metadata.Item>{formatTokenCount(usage.outputTokens ?? 0)} out</Metadata.Item>
      </Metadata>
    );
  const avgItemDuration = metrics?.isEnabled ? metrics.data?.avgAgentDurationMs : undefined;
  const formattedAvgItemDuration = avgItemDuration == null ? undefined : formatDuration(Math.round(avgItemDuration));

  const runDurationDetail = (() => {
    if (formattedAvgItemDuration) return `${formattedAvgItemDuration} avg per item`;
    return startedAt ? `started ${formatDate(new Date(startedAt), 'date-time')}` : 'not started';
  })();

  return (
    <MetricsCardGroup>
      {metrics?.isEnabled && (
        <KpiCard
          label="Total cost"
          icon={IconCoins}
          value={usage?.estimatedCost === undefined ? '—' : formatCostValue(usage.estimatedCost, usage.costUnit)}
          detail="estimated"
          isLoading={isUsageLoading}
        />
      )}
      <KpiCard label="Run duration" icon={IconStopwatch} value={duration} detail={runDurationDetail} />
      {metrics?.isEnabled && (
        <KpiCard
          label="Total tokens"
          icon={IconHashtag}
          value={tokens === undefined ? '—' : formatTokenCount(tokens)}
          detail={tokensDetail}
          isLoading={isUsageLoading}
        />
      )}
      <KpiCard
        label="Avg score"
        icon={IconGauge}
        value={avgScore == null ? '—' : avgScore.toFixed(3)}
        detail={avgScore == null ? 'no scores' : 'across all scorers'}
        isLoading={avgScore === undefined}
      />
    </MetricsCardGroup>
  );
}
