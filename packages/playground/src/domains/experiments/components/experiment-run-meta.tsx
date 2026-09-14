import type { DatasetExperiment } from '@mastra/client-js';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { formatCompact, formatCost } from '@mastra/playground-ui/domains/metrics/components/metrics-utils';
import { format, formatDistanceToNow } from 'date-fns';
import { type ReactNode, useMemo } from 'react';
import type { ExperimentMetrics } from '../hooks/use-experiment-metrics';
import { useScoresByExperimentId } from '@/domains/datasets/hooks/use-dataset-experiments';

export interface ExperimentRunMetaProps {
  experiment: DatasetExperiment;
  metrics?: {
    data?: ExperimentMetrics;
    isLoading: boolean;
    isEnabled: boolean;
  };
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <DataKeysAndValues.Key>{label}</DataKeysAndValues.Key>
      <DataKeysAndValues.Value className="flex flex-wrap items-baseline justify-end gap-x-1.5 text-right">
        {children}
      </DataKeysAndValues.Value>
    </>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1).replace(/\.0$/, '')}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

/**
 * Key/value list of the run's measurements — Avg score / Items / Started /
 * Duration, plus Tokens / Latency when the observability store supports metrics.
 * The dataset lives in the pipeline, so it is not repeated here.
 */
export function ExperimentRunMeta({ experiment, metrics }: ExperimentRunMetaProps) {
  const { data: scoresByItemId } = useScoresByExperimentId(experiment.id, experiment.status);
  const isActive = experiment.status === 'running' || experiment.status === 'pending';

  // Averages every score fetched so far, so a running experiment reflects only
  // the items scored up to now.
  const overallAverage = useMemo(() => {
    if (!scoresByItemId) return undefined;
    const scores = Object.values(scoresByItemId).flat();
    if (scores.length === 0) return undefined;
    return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
  }, [scoresByItemId]);

  const startedAt = experiment.startedAt ?? experiment.createdAt;
  const startedDate = startedAt ? new Date(startedAt) : null;

  const durationValue = (() => {
    if (experiment.status === 'running') return 'Running…';
    if (!experiment.startedAt || !experiment.completedAt) return '—';
    const ms = new Date(experiment.completedAt).getTime() - new Date(experiment.startedAt).getTime();
    if (ms < 0) return '—';
    return formatDuration(ms);
  })();

  return (
    <DataKeysAndValues>
      <MetaRow label="Avg score">
        {overallAverage === undefined ? (
          <span className="text-neutral3">—</span>
        ) : (
          <>
            <span>{overallAverage.toFixed(3)}</span>
            {isActive && <span className="text-neutral3">· so far</span>}
          </>
        )}
      </MetaRow>

      <MetaRow label="Items">
        {isActive ? (
          <span className="text-neutral3">
            {(experiment.succeededCount ?? 0) + (experiment.failedCount ?? 0)}/{experiment.totalItems} items processed
          </span>
        ) : (
          <>
            <span>
              {experiment.totalItems} item{experiment.totalItems === 1 ? '' : 's'}
            </span>
            {(experiment.failedCount ?? 0) > 0 && (
              <span className="text-error">· {experiment.failedCount} errored</span>
            )}
          </>
        )}
      </MetaRow>

      <MetaRow label="Started">
        {startedDate ? (
          <span title={formatDistanceToNow(startedDate, { addSuffix: true })}>
            {format(startedDate, 'MMM d, h:mm a')}
          </span>
        ) : (
          <span>—</span>
        )}
      </MetaRow>

      <MetaRow label="Duration">
        <span>{durationValue}</span>
      </MetaRow>

      {metrics?.isEnabled && (
        <>
          <MetaRow label="Tokens">
            {metrics.data?.totalTokens == null ? (
              <span className="text-neutral3">—</span>
            ) : (
              <>
                <span>{formatCompact(metrics.data.totalTokens)}</span>
                {metrics.data.estimatedCost != null && (
                  <span className="text-neutral3">
                    · {formatCost(metrics.data.estimatedCost, metrics.data.costUnit)}
                  </span>
                )}
                {isActive && <span className="text-neutral3">· so far</span>}
              </>
            )}
          </MetaRow>

          <MetaRow label="Latency (avg)">
            {metrics.data?.avgAgentDurationMs == null ? (
              <span className="text-neutral3">—</span>
            ) : (
              <span>{formatDuration(Math.round(metrics.data.avgAgentDurationMs))}</span>
            )}
          </MetaRow>
        </>
      )}
    </DataKeysAndValues>
  );
}
