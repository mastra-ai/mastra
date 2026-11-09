import type { MastraClient } from '@mastra/client-js';

type GetMetricPercentilesResponse = Awaited<ReturnType<MastraClient['getMetricPercentiles']>>;

export const latencyPercentiles: GetMetricPercentilesResponse = {
  series: [
    {
      percentile: 0.5,
      points: [
        { timestamp: '2026-06-01T00:00:00.000Z', value: 120.4 },
        { timestamp: '2026-06-02T00:00:00.000Z', value: 140.6 },
      ],
    },
    {
      percentile: 0.95,
      points: [
        { timestamp: '2026-06-01T00:00:00.000Z', value: 480.2 },
        { timestamp: '2026-06-02T00:00:00.000Z', value: 610.7 },
      ],
    },
  ],
};
