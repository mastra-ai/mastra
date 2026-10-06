import type { MastraClient } from '@mastra/client-js';

type AggregateResponse = Awaited<ReturnType<MastraClient['getMetricAggregate']>>;
type BreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type TimeSeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
type PercentilesResponse = Awaited<ReturnType<MastraClient['getMetricPercentiles']>>;

/** Two hours ago: inside the last-24-hours window every test renders. */
const recent = () => new Date(Date.now() - 2 * 3_600_000).toISOString();

/** Agent runs KPI: this range against the previous one. */
export const agentRunsAggregateFixture: AggregateResponse = {
  value: 693,
  previousValue: 891,
  changePercent: -22.2,
};

export const emptyAggregateFixture: AggregateResponse = {
  value: 0,
  previousValue: 0,
  changePercent: null,
};

/** Trace volume: Chef Agent ran 12 times, 2 of them failed. */
export const agentVolumeBreakdownFixture: BreakdownResponse = {
  groups: [
    { dimensions: { entityName: 'Chef Agent', status: 'ok' }, value: 10 },
    { dimensions: { entityName: 'Chef Agent', status: 'error' }, value: 2 },
  ],
};

export const emptyBreakdownFixture: BreakdownResponse = { groups: [] };

/** One bucket of one token metric (input, output or cache reads), with its estimated cost. */
export function tokenSeriesFixture(value: number, estimatedCost: number): TimeSeriesResponse {
  return { series: [{ name: 'tokens', points: [{ timestamp: recent(), value, estimatedCost }] }] };
}

/** One bucket of agent runs: 8 completed, 2 failed (one `error`, one `failed`). */
export function agentRunSeriesFixture(): TimeSeriesResponse {
  return {
    series: [
      { name: 'ok', points: [{ timestamp: recent(), value: 8 }] },
      { name: 'error', points: [{ timestamp: recent(), value: 1 }] },
      { name: 'failed', points: [{ timestamp: recent(), value: 1 }] },
    ],
  };
}

export const emptySeriesFixture: TimeSeriesResponse = { series: [] };

/** One bucket of agent run durations: P50 1.2s, P95 4.5s. */
export function agentLatencyFixture(): PercentilesResponse {
  return {
    series: [
      { percentile: 0.5, points: [{ timestamp: recent(), value: 1200 }] },
      { percentile: 0.95, points: [{ timestamp: recent(), value: 4500 }] },
    ],
  };
}

export const emptyPercentilesFixture: PercentilesResponse = { series: [] };

/** The server's error body when a metrics query fails. */
export const metricsErrorFixture = { error: 'Failed to query metrics' };

/** Memory: one thread with 3 agent runs. */
export const threadRunsBreakdownFixture: BreakdownResponse = {
  groups: [{ dimensions: { threadId: 'thread-1', resourceId: 'user-1' }, value: 3 }],
};
