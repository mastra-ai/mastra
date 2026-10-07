import type { MastraClient } from '@mastra/client-js';

export type MetricPercentilesResponse = Awaited<ReturnType<MastraClient['getMetricPercentiles']>>;

export const latencyPercentiles: MetricPercentilesResponse = {
  series: [
    {
      percentile: 0.5,
      points: [
        { timestamp: '2026-06-01T00:00:00.000Z', value: 120 },
        { timestamp: '2026-06-01T01:00:00.000Z', value: 140 },
      ],
    },
    {
      percentile: 0.95,
      points: [
        { timestamp: '2026-06-01T00:00:00.000Z', value: 480 },
        { timestamp: '2026-06-01T01:00:00.000Z', value: 620 },
      ],
    },
  ],
};

export const emptyPercentiles: MetricPercentilesResponse = { series: [] };
