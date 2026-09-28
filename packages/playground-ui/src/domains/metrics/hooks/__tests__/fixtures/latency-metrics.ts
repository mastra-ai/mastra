import type { GetMetricPercentilesResponse } from '@mastra/client-js';

export const latencyPercentiles: GetMetricPercentilesResponse = {
  series: [
    {
      percentile: 0.5,
      points: [
        { timestamp: new Date('2026-06-01T00:00:00.000Z'), value: 120.4 },
        { timestamp: new Date('2026-06-02T00:00:00.000Z'), value: 140.6 },
      ],
    },
    {
      percentile: 0.95,
      points: [
        { timestamp: new Date('2026-06-01T00:00:00.000Z'), value: 480.2 },
        { timestamp: new Date('2026-06-02T00:00:00.000Z'), value: 610.7 },
      ],
    },
  ],
};
