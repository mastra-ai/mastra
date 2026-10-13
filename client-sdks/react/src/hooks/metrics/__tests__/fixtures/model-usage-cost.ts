import type { MastraClient } from '@mastra/client-js';

type GetMetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

export const sameModelTwoProviders: GetMetricBreakdownResponse = {
  groups: [
    { dimensions: { model: 'gpt-4o', provider: 'openai' }, value: 100, estimatedCost: 1, costUnit: 'usd' },
    { dimensions: { model: 'gpt-4o', provider: 'azure' }, value: 50, estimatedCost: 0.5, costUnit: 'usd' },
  ],
};

export const emptyModelBreakdown: GetMetricBreakdownResponse = { groups: [] };
