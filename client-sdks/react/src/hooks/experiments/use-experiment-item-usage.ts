import type { GetMetricBreakdownResponse } from '@mastra/core/storage';
import { useQueries } from '@tanstack/react-query';
import type { Query } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { ExperimentRef } from '../datasets/use-dataset-experiments';
import { useCombineByIds } from '../shared/combine-by-ids';
import type { ExperimentQueriesResult } from '../shared/combine-by-ids';
import { getOrCreate } from '../shared/map';

const INPUT_TOKEN_METRIC = 'mastra_model_total_input_tokens';
const OUTPUT_TOKEN_METRIC = 'mastra_model_total_output_tokens';
const POLL_INTERVAL_MS = 2000;

export interface ExperimentItemUsage {
  inputTokens?: number;
  outputTokens?: number;
  /** Undefined when no group is priced or when groups use different cost units. */
  estimatedCost?: number;
  costUnit?: string;
}

/** Usage of one experiment: its totals, and each item's usage keyed by the trace id of its run. */
export interface ExperimentUsage {
  /** Totals across every item. The cost sums priced groups only. */
  summary: ExperimentItemUsage;
  traces: Record<string, ExperimentItemUsage>;
}

type UsageAccumulator = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost: number;
  costUnits: Set<string>;
  hasUnknownCostUnit: boolean;
};

const createAccumulator = (): UsageAccumulator => ({
  estimatedCost: 0,
  costUnits: new Set(),
  hasUnknownCostUnit: false,
});

type BreakdownGroup = GetMetricBreakdownResponse['groups'][number];

function accumulate(accumulator: UsageAccumulator, tokenField: 'inputTokens' | 'outputTokens', group: BreakdownGroup) {
  accumulator[tokenField] = (accumulator[tokenField] ?? 0) + group.value;

  if (group.estimatedCost == null) return;
  accumulator.estimatedCost += group.estimatedCost;
  if (group.costUnit) {
    accumulator.costUnits.add(group.costUnit.toLowerCase());
  } else {
    accumulator.hasUnknownCostUnit = true;
  }
}

function toUsage(accumulator: UsageAccumulator): ExperimentItemUsage {
  // A single known unit implies at least one priced group.
  const isPriced = !accumulator.hasUnknownCostUnit && accumulator.costUnits.size === 1;
  return {
    inputTokens: accumulator.inputTokens,
    outputTokens: accumulator.outputTokens,
    estimatedCost: isPriced ? accumulator.estimatedCost : undefined,
    costUnit: isPriced ? [...accumulator.costUnits][0] : undefined,
  };
}

/** Builds the experiment totals and the per-trace usage in a single pass over the groups. */
function toExperimentUsage(response: GetMetricBreakdownResponse): ExperimentUsage {
  const summary = createAccumulator();
  const accumulators = new Map<string, UsageAccumulator>();

  for (const group of response.groups) {
    const metricName = group.dimensions.name;
    if (metricName !== INPUT_TOKEN_METRIC && metricName !== OUTPUT_TOKEN_METRIC) continue;

    const tokenField = metricName === INPUT_TOKEN_METRIC ? 'inputTokens' : 'outputTokens';
    accumulate(summary, tokenField, group);

    const traceId = group.dimensions.traceId;
    if (traceId) accumulate(getOrCreate(accumulators, traceId, createAccumulator), tokenField, group);
  }

  const traces: Record<string, ExperimentItemUsage> = {};
  for (const [traceId, accumulator] of accumulators) {
    traces[traceId] = toUsage(accumulator);
  }
  return { summary: toUsage(summary), traces };
}

/** How many breakdowns to fetch after completion while the exporter may still be flushing metrics. */
const MAX_EMPTY_ATTEMPTS = 5;

const isEmptyUsage = (usage: ExperimentUsage | undefined) =>
  !usage ||
  (Object.keys(usage.traces).length === 0 &&
    usage.summary.inputTokens === undefined &&
    usage.summary.outputTokens === undefined);

/**
 * Token and cost usage of several experiments, keyed by experiment id: each entry holds the
 * experiment totals (`summary`) and every item's usage keyed by trace id (`traces`).
 * Sends one metric breakdown request per experiment, filtered by its id rather than by trace ids,
 * so it does not wait for the experiment results. Usage is only fetched once an experiment has
 * finished; while the breakdown is still empty (metrics flushing), it retries every 2 seconds up to
 * 5 attempts. No request is made when the observability store cannot serve metrics.
 */
export const useExperimentsItemUsage = ({
  experiments,
  supportsMetrics,
}: {
  experiments: ExperimentRef[];
  supportsMetrics: boolean;
}): ExperimentQueriesResult<ExperimentUsage> => {
  const client = useMastraClient();
  const combine = useCombineByIds<ExperimentUsage>(experiments.map(experiment => experiment.id));

  return useQueries({
    queries: experiments.map(({ id, status }) => {
      const finished = status !== 'running' && status !== 'pending';
      return {
        queryKey: ['experiment-item-usage', id, finished],
        queryFn: async () =>
          toExperimentUsage(
            await client.getMetricBreakdown({
              name: [INPUT_TOKEN_METRIC, OUTPUT_TOKEN_METRIC],
              aggregation: 'sum',
              groupBy: ['traceId', 'name'],
              filters: { experimentId: id },
            }),
          ),
        enabled: supportsMetrics && finished,
        refetchInterval: (query: Query<ExperimentUsage>) =>
          isEmptyUsage(query.state.data) && query.state.dataUpdateCount < MAX_EMPTY_ATTEMPTS ? POLL_INTERVAL_MS : false,
      };
    }),
    combine,
  });
};
