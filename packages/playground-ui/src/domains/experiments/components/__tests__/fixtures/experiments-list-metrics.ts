import type { MastraClient } from '@mastra/client-js';
import { experiments } from './experiments';

type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

/** Token breakdown grouped by experiment: model-a uses 9,000 in + 3,400 out tokens = 12.4K, $0.0123. */
export const experimentsTokenBreakdown: MetricBreakdownResponse = {
  groups: [
    {
      dimensions: { experimentId: experiments[0].id, name: 'mastra_model_total_input_tokens' },
      value: 9000,
      estimatedCost: 0.009,
      costUnit: 'usd',
    },
    {
      dimensions: { experimentId: experiments[0].id, name: 'mastra_model_total_output_tokens' },
      value: 3400,
      estimatedCost: 0.0033,
      costUnit: 'usd',
    },
  ],
};

/** Average agent duration grouped by experiment: model-a averages 2.5s per run. */
export const experimentsDurationBreakdown: MetricBreakdownResponse = {
  groups: [{ dimensions: { experimentId: experiments[0].id }, value: 2500 }],
};
