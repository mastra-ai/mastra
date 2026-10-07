import type { GetMetricAggregateResponse } from '@mastra/client-js';
import type { MetricsRequest } from '../msw-handlers';

export const emptyAggregate: GetMetricAggregateResponse = { value: null };

export const agentRunsAggregate: GetMetricAggregateResponse = {
  value: 1500,
  previousValue: 1000,
  changePercent: 50,
};

export const modelCostAggregate: GetMetricAggregateResponse = {
  value: 20000,
  estimatedCost: 12.5,
  costUnit: 'usd',
  previousEstimatedCost: 10,
  costChangePercent: 25,
};

export const flatAggregate: GetMetricAggregateResponse = {
  value: 42,
  previousValue: 42,
  changePercent: 0,
};

/** Total tokens sums the input and output aggregates. */
export const totalTokensAggregate = ({ name }: MetricsRequest): GetMetricAggregateResponse =>
  name[0] === 'mastra_model_total_output_tokens'
    ? { value: 500, previousValue: 500 }
    : { value: 1500, previousValue: 500 };

/** Active threads and active resources both count distinct values on agent runs. */
export const distinctAggregate = ({ distinctColumn }: MetricsRequest): GetMetricAggregateResponse =>
  distinctColumn === 'threadId' ? { value: 87, previousValue: 100, changePercent: -13 } : { value: 9 };
