import type { MastraClient } from '@mastra/client-js';

type AggregateResponse = Awaited<ReturnType<MastraClient['getMetricAggregate']>>;
type BreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type TimeSeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
type PercentilesResponse = Awaited<ReturnType<MastraClient['getMetricPercentiles']>>;
type ListScoresResponse = Awaited<ReturnType<MastraClient['listScores']>>;
type ScoreAggregateResponse = Awaited<ReturnType<MastraClient['getScoreAggregate']>>;
type ScoreTimeSeriesResponse = Awaited<ReturnType<MastraClient['getScoreTimeSeries']>>;

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

/** Usage by thread: input and output tokens summed, with their estimated cost. */
export const threadSpendBreakdownFixture: BreakdownResponse = {
  groups: [
    { dimensions: { threadId: 'thread-big' }, value: 42_000, estimatedCost: 1.25 },
    { dimensions: { threadId: 'thread-small' }, value: 900, estimatedCost: 0.02 },
  ],
};

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

/** The most recent scores in the range: one scorer, Answer relevancy. */
export function recentScoresFixture(): ListScoresResponse {
  return {
    pagination: { total: 1, page: 0, perPage: 100, hasMore: false },
    scores: [
      { scorerId: 'answer-relevancy', scorerName: 'Answer relevancy', score: 0.84, timestamp: new Date(recent()) },
    ],
  };
}

export const emptyScoresFixture: ListScoresResponse = {
  pagination: { total: 0, page: 0, perPage: 100, hasMore: false },
  scores: [],
};

/** Answer relevancy's mean over the range. */
export const scoreAggregateFixture: ScoreAggregateResponse = { value: 0.84, previousValue: null, changePercent: null };

/** One bucket of Answer relevancy's average score. */
export function scoreSeriesFixture(): ScoreTimeSeriesResponse {
  return { series: [{ name: 'answer-relevancy', points: [{ timestamp: new Date(recent()), value: 0.84 }] }] };
}
