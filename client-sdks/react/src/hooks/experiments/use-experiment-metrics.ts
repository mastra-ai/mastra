import type { DatasetExperiment } from '@mastra/client-js';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export interface ExperimentMetrics {
  totalTokens: number | null;
  estimatedCost: number | null;
  costUnit: string | null;
  avgAgentDurationMs: number | null;
  agentRuns: number | null;
}

interface UseExperimentMetricsArgs {
  experimentId: string | undefined;
  experimentStatus: DatasetExperiment['status'] | undefined;
  /** Whether the observability store can serve metrics; no requests are made when false. */
  supportsMetrics: boolean;
}

/**
 * Experiment-scoped metrics (tokens, cost, avg agent latency).
 * Filters only by experimentId — no time window, since the experiment already bounds the row set.
 * Polls every 2 seconds while the experiment is running or pending.
 */
export const useExperimentMetrics = ({ experimentId, experimentStatus, supportsMetrics }: UseExperimentMetricsArgs) => {
  const client = useMastraClient();
  const isEnabled = Boolean(experimentId) && supportsMetrics;
  const isActive = experimentStatus === 'running' || experimentStatus === 'pending';

  const query = useQuery({
    queryKey: ['experiment-metrics', experimentId],
    enabled: isEnabled,
    refetchInterval: isActive ? 2000 : false,
    queryFn: async (): Promise<ExperimentMetrics> => {
      // `enabled` already guards this; the check exists to narrow the type.
      if (!experimentId) throw new Error('experimentId is required');
      const filters = { experimentId };

      const [tokens, avgDuration, runs] = await Promise.all([
        client.getMetricAggregate({
          name: ['mastra_model_total_input_tokens', 'mastra_model_total_output_tokens'],
          aggregation: 'sum',
          filters,
        }),
        client.getMetricAggregate({ name: ['mastra_agent_duration_ms'], aggregation: 'avg', filters }),
        client.getMetricAggregate({ name: ['mastra_agent_duration_ms'], aggregation: 'count', filters }),
      ]);

      return {
        totalTokens: tokens.value ?? null,
        estimatedCost: tokens.estimatedCost ?? null,
        costUnit: tokens.costUnit ?? null,
        avgAgentDurationMs: avgDuration.value ?? null,
        agentRuns: runs.value ?? null,
      };
    },
  });

  return { data: query.data, isLoading: query.isLoading, isEnabled };
};
