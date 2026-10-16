import type { GetMetricBreakdownResponse } from '@mastra/core/storage';

export const INPUT_TOKEN_METRIC = 'mastra_model_total_input_tokens';
export const OUTPUT_TOKEN_METRIC = 'mastra_model_total_output_tokens';

export interface ExperimentItemUsage {
  inputTokens?: number;
  outputTokens?: number;
  /** Undefined when no group is priced or when groups use different cost units. */
  estimatedCost?: number;
  costUnit?: string;
}

export type UsageAccumulator = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost: number;
  costUnits: Set<string>;
  hasUnknownCostUnit: boolean;
};

export const createAccumulator = (): UsageAccumulator => ({
  estimatedCost: 0,
  costUnits: new Set(),
  hasUnknownCostUnit: false,
});

type BreakdownGroup = GetMetricBreakdownResponse['groups'][number];

/** The token field a breakdown group feeds, or undefined when the group is not a token metric. */
export function tokenFieldOf(group: BreakdownGroup): 'inputTokens' | 'outputTokens' | undefined {
  const metricName = group.dimensions.name;
  if (metricName === INPUT_TOKEN_METRIC) return 'inputTokens';
  if (metricName === OUTPUT_TOKEN_METRIC) return 'outputTokens';
  return undefined;
}

export function accumulate(
  accumulator: UsageAccumulator,
  tokenField: 'inputTokens' | 'outputTokens',
  group: BreakdownGroup,
) {
  accumulator[tokenField] = (accumulator[tokenField] ?? 0) + group.value;

  if (group.estimatedCost == null) return;
  accumulator.estimatedCost += group.estimatedCost;
  if (group.costUnit) {
    accumulator.costUnits.add(group.costUnit.toLowerCase());
  } else {
    accumulator.hasUnknownCostUnit = true;
  }
}

export function toUsage(accumulator: UsageAccumulator): ExperimentItemUsage {
  // A single known unit implies at least one priced group.
  const isPriced = !accumulator.hasUnknownCostUnit && accumulator.costUnits.size === 1;
  return {
    inputTokens: accumulator.inputTokens,
    outputTokens: accumulator.outputTokens,
    estimatedCost: isPriced ? accumulator.estimatedCost : undefined,
    costUnit: isPriced ? [...accumulator.costUnits][0] : undefined,
  };
}
