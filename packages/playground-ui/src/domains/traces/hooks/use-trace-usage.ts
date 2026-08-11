import type { GetMetricBreakdownResponse } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { TraceUsageSummary } from '../trace-list-columns';
import { getOrCreate } from '@/lib/map';

const INPUT_TOKEN_METRIC = 'mastra_model_total_input_tokens';
const OUTPUT_TOKEN_METRIC = 'mastra_model_total_output_tokens';
// Each trace can return two groups, while the breakdown endpoint allows at most 1,000.
const TRACE_IDS_PER_REQUEST = 500;

type TraceUsageAccumulator = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost: number;
  hasEstimatedCost: boolean;
  costUnits: Set<string>;
  hasUnknownCostUnit: boolean;
};

function chunkTraceIds(traceIds: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < traceIds.length; index += TRACE_IDS_PER_REQUEST) {
    chunks.push(traceIds.slice(index, index + TRACE_IDS_PER_REQUEST));
  }
  return chunks;
}

function createTraceUsageAccumulator(): TraceUsageAccumulator {
  return {
    estimatedCost: 0,
    hasEstimatedCost: false,
    costUnits: new Set(),
    hasUnknownCostUnit: false,
  };
}

function addBreakdown(accumulators: Map<string, TraceUsageAccumulator>, response: GetMetricBreakdownResponse) {
  for (const group of response.groups) {
    const traceId = group.dimensions.traceId;
    const metricName = group.dimensions.name;
    if (!traceId || (metricName !== INPUT_TOKEN_METRIC && metricName !== OUTPUT_TOKEN_METRIC)) continue;

    const accumulator = getOrCreate(accumulators, traceId, createTraceUsageAccumulator);
    const tokenField = metricName === INPUT_TOKEN_METRIC ? 'inputTokens' : 'outputTokens';
    accumulator[tokenField] = (accumulator[tokenField] ?? 0) + group.value;

    if (group.estimatedCost == null) continue;
    accumulator.estimatedCost += group.estimatedCost;
    accumulator.hasEstimatedCost = true;
    if (group.costUnit) {
      accumulator.costUnits.add(group.costUnit.toLowerCase());
    } else {
      accumulator.hasUnknownCostUnit = true;
    }
  }
}

function summarizeUsage(accumulators: Map<string, TraceUsageAccumulator>): Map<string, TraceUsageSummary> {
  const summaries = new Map<string, TraceUsageSummary>();
  for (const [traceId, accumulator] of accumulators) {
    const summary: TraceUsageSummary = {
      inputTokens: accumulator.inputTokens,
      outputTokens: accumulator.outputTokens,
    };

    if (accumulator.hasEstimatedCost && !accumulator.hasUnknownCostUnit && accumulator.costUnits.size === 1) {
      summary.estimatedCost = accumulator.estimatedCost;
      summary.costUnit = [...accumulator.costUnits][0];
    }

    summaries.set(traceId, summary);
  }
  return summaries;
}

export function useTraceUsage({
  traceIds,
  enabled,
  autoRefetch,
}: {
  traceIds: readonly string[];
  enabled: boolean;
  autoRefetch: boolean;
}) {
  const client = useMastraClient();
  const uniqueTraceIds = [...new Set(traceIds)].toSorted();
  const projectUrl =
    client.options.baseUrl || (typeof window === 'undefined' ? 'local' : window.location.origin || 'local');
  const projectKey = `${projectUrl}:${client.options.apiPrefix ?? '/api'}`;

  return useQuery({
    queryKey: ['trace-usage', projectKey, uniqueTraceIds],
    enabled: enabled && uniqueTraceIds.length > 0,
    queryFn: async () => {
      const batches = chunkTraceIds(uniqueTraceIds);
      const responses = await Promise.allSettled(
        batches.map(batch =>
          client.getMetricBreakdown({
            name: [INPUT_TOKEN_METRIC, OUTPUT_TOKEN_METRIC],
            aggregation: 'sum',
            groupBy: ['traceId', 'name'],
            filters: { traceIds: batch },
            limit: batch.length * 2,
          }),
        ),
      );

      const accumulators = new Map<string, TraceUsageAccumulator>();
      for (const response of responses) {
        if (response.status === 'fulfilled') {
          addBreakdown(accumulators, response.value);
        }
      }
      return summarizeUsage(accumulators);
    },
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[1] === projectKey ? previousData : undefined,
    refetchInterval: enabled && autoRefetch ? 10_000 : false,
  });
}
