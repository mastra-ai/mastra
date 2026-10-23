import type { AggregateTracesResponse, MastraClient } from '@mastra/client-js';

type TimeSeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
type BreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type AggregateRow = AggregateTracesResponse['rows'][number];

const recent = () => new Date(Date.now() - 2 * 3_600_000).toISOString();

const row = (dimensions: AggregateRow['dimensions'], measures: AggregateRow['measures']): AggregateRow => ({
  dimensions,
  measures,
});

/** Agent runs per agent, nested runs included: the busiest agent never starts a trace. */
export const agentRunsByName: AggregateTracesResponse = {
  rows: [
    row({ entityName: 'Explore Subagent' }, { count: 120, errorCount: 2, errorRate: 2 / 120, 'duration.p95': 900 }),
    row({ entityName: 'Code Agent' }, { count: 40, errorCount: 8, errorRate: 0.2, 'duration.p95': 42_000 }),
    row({ entityName: 'Reflector' }, { count: 10, errorCount: 0, errorRate: 0, 'duration.p95': 3_000 }),
  ],
  truncated: false,
};

/** Tokens and cost per agent; Reflector's model has no price. */
export const agentTokensByName: TimeSeriesResponse = {
  series: [
    { name: 'Code Agent', costUnit: 'USD', points: [{ timestamp: recent(), value: 2_000_000, estimatedCost: 12.5 }] },
    { name: 'Explore Subagent', costUnit: 'USD', points: [{ timestamp: recent(), value: 50_000, estimatedCost: 0.4 }] },
    { name: 'Reflector', points: [{ timestamp: recent(), value: 3_000 }] },
  ],
};

export const toolCallsByName: AggregateTracesResponse = {
  rows: [row({ entityName: 'search' }, { count: 300, errorCount: 30, errorRate: 0.1, 'duration.p95': 1_200 })],
  truncated: false,
};

export const tracesByEnvironment: AggregateTracesResponse = {
  rows: [
    row({ environment: 'production' }, { count: 500, errorRate: 0.01, 'duration.p95': 5_000 }),
    row({ environment: 'staging' }, { count: 50, errorRate: 0.1, 'duration.p95': 6_000 }),
  ],
  truncated: false,
};

export const tokensByEnvironment: TimeSeriesResponse = {
  series: [{ name: 'production', costUnit: 'USD', points: [{ timestamp: recent(), value: 10_000, estimatedCost: 1 }] }],
};

export function tracesByProject(projectIds: string[]): AggregateTracesResponse {
  return {
    rows: projectIds.map((projectId, i) =>
      row({ projectId }, { count: 100 * (projectIds.length - i), errorRate: 0.05, 'duration.p95': 2_000 }),
    ),
    truncated: false,
  };
}

export const agentRunsByProjectAndName: AggregateTracesResponse = {
  rows: [
    row({ projectId: 'p1', entityName: 'Code Agent' }, { count: 7, errorCount: 0, errorRate: 0, 'duration.p95': 100 }),
  ],
  truncated: false,
};

/** More tools than the server returns: it keeps the busiest and says so. */
export const truncatedToolCalls: AggregateTracesResponse = { ...toolCallsByName, truncated: true };

/** The same agents over the previous window: Explore Subagent doubled, Code Agent's errors went up. */
export const previousAgentRunsByName: AggregateTracesResponse = {
  rows: [
    row({ entityName: 'Explore Subagent' }, { count: 60, errorCount: 1, errorRate: 1 / 60, 'duration.p95': 1_000 }),
    row({ entityName: 'Code Agent' }, { count: 40, errorCount: 2, errorRate: 0.05, 'duration.p95': 40_000 }),
  ],
  truncated: false,
};

/** Agent tokens and cost over the previous window: Code Agent spent $5, less than now. */
export const previousAgentUsage: BreakdownResponse = {
  groups: [{ dimensions: { entityName: 'Code Agent' }, value: 1_000_000, estimatedCost: 5, costUnit: 'USD' }],
};

/** Tokens and cost per model; no runs, since a run isn't tied to one model. */
export const usageByModel: BreakdownResponse = {
  groups: [
    { dimensions: { model: 'gpt-5' }, value: 2_000_000, estimatedCost: 12, costUnit: 'USD' },
    { dimensions: { model: 'claude-haiku-4-5' }, value: 5_000_000, estimatedCost: 4, costUnit: 'USD' },
  ],
};

/** Traces per thread. */
export const tracesByThread: AggregateTracesResponse = {
  rows: [
    row({ threadId: 'thread-a' }, { count: 30, errorRate: 0.1, 'duration.p95': 5_000 }),
    row({ threadId: 'thread-b' }, { count: 5, errorRate: 0, 'duration.p95': 800 }),
  ],
  truncated: false,
};

/** Tokens and cost per thread; usage outside any thread comes back as a null thread. */
export const usageByThread: BreakdownResponse = {
  groups: [
    { dimensions: { threadId: 'thread-a' }, value: 40_000, estimatedCost: 0.4, costUnit: 'USD' },
    { dimensions: { threadId: null }, value: 9_000, estimatedCost: 0.09, costUnit: 'USD' },
  ],
};

/** The previous window with an agent that has stopped running since. */
export const previousWithRetiredAgent: AggregateTracesResponse = {
  rows: [
    ...previousAgentRunsByName.rows,
    row({ entityName: 'Retired Agent' }, { count: 25, errorCount: 0, errorRate: 0, 'duration.p95': 2_000 }),
  ],
  truncated: false,
};
