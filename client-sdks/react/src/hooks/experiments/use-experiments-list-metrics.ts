import type { GetMetricBreakdownResponse } from '@mastra/core/storage';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { ExperimentRef } from '../datasets/use-dataset-experiments';
import { getOrCreate } from '../shared/map';
import {
  INPUT_TOKEN_METRIC,
  OUTPUT_TOKEN_METRIC,
  accumulate,
  createAccumulator,
  tokenFieldOf,
  toUsage,
} from './usage-accumulator';
import type { ExperimentItemUsage, UsageAccumulator } from './usage-accumulator';

const AGENT_DURATION_METRIC = 'mastra_agent_duration_ms';
// Each experiment can return two token groups, while the breakdown endpoint allows at most 1,000.
const EXPERIMENT_IDS_PER_REQUEST = 500;
const POLL_INTERVAL_MS = 5000;

/** Totals of one experiment: token usage, its estimated cost, and the average agent run duration. */
export interface ExperimentListMetrics extends ExperimentItemUsage {
  avgDurationMs?: number;
}

function chunk(ids: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += EXPERIMENT_IDS_PER_REQUEST) {
    chunks.push(ids.slice(index, index + EXPERIMENT_IDS_PER_REQUEST));
  }
  return chunks;
}

function settledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
}

/**
 * Builds each requested experiment's metrics. Groups for other experiments are skipped,
 * in case a store ignores the `experimentIds` filter.
 */
function toListMetrics(
  experimentIds: readonly string[],
  tokenResponses: GetMetricBreakdownResponse[],
  durationResponses: GetMetricBreakdownResponse[],
): Map<string, ExperimentListMetrics> {
  const requested = new Set(experimentIds);
  const accumulators = new Map<string, UsageAccumulator>();
  for (const group of tokenResponses.flatMap(response => response.groups)) {
    const experimentId = group.dimensions.experimentId;
    const tokenField = tokenFieldOf(group);
    if (!experimentId || !requested.has(experimentId) || !tokenField) continue;
    accumulate(getOrCreate(accumulators, experimentId, createAccumulator), tokenField, group);
  }

  const metrics = new Map<string, ExperimentListMetrics>();
  for (const [experimentId, accumulator] of accumulators) {
    metrics.set(experimentId, toUsage(accumulator));
  }
  for (const group of durationResponses.flatMap(response => response.groups)) {
    const experimentId = group.dimensions.experimentId;
    if (!experimentId || !requested.has(experimentId)) continue;
    getOrCreate(metrics, experimentId, (): ExperimentListMetrics => ({})).avgDurationMs = group.value;
  }
  return metrics;
}

/**
 * Token usage, estimated cost and average agent duration of many experiments, keyed by experiment id.
 * Sends two metric breakdowns per 500 experiments (tokens grouped by experiment and metric name,
 * durations grouped by experiment) instead of one request per experiment.
 * Experiments without any metric are absent from the map. Polls while an experiment is running
 * or pending. No request is made when the observability store cannot serve metrics.
 */
export const useExperimentsListMetrics = ({
  experiments,
  supportsMetrics,
}: {
  experiments: ExperimentRef[];
  supportsMetrics: boolean;
}): UseQueryResult<Map<string, ExperimentListMetrics>, Error> => {
  const client = useMastraClient();
  const experimentIds = [...new Set(experiments.map(experiment => experiment.id))].toSorted();
  const hasActiveExperiment = experiments.some(({ status }) => status === 'running' || status === 'pending');

  return useQuery({
    queryKey: ['experiments-list-metrics', experimentIds],
    enabled: supportsMetrics && experimentIds.length > 0,
    queryFn: async () => {
      const batches = chunk(experimentIds);
      const [tokenResults, durationResults] = await Promise.all([
        Promise.allSettled(
          batches.map(batch =>
            client.getMetricBreakdown({
              name: [INPUT_TOKEN_METRIC, OUTPUT_TOKEN_METRIC],
              aggregation: 'sum',
              groupBy: ['experimentId', 'name'],
              filters: { experimentIds: batch },
              limit: batch.length * 2,
            }),
          ),
        ),
        Promise.allSettled(
          batches.map(batch =>
            client.getMetricBreakdown({
              name: [AGENT_DURATION_METRIC],
              aggregation: 'avg',
              groupBy: ['experimentId'],
              filters: { experimentIds: batch },
              limit: batch.length,
            }),
          ),
        ),
      ]);
      return toListMetrics(experimentIds, settledValues(tokenResults), settledValues(durationResults));
    },
    // Loading another page changes the ids; keep the rows already shown filled meanwhile.
    placeholderData: keepPreviousData,
    refetchInterval: hasActiveExperiment ? POLL_INTERVAL_MS : false,
  });
};
