import type { AggregateTracesResponse, MastraClient } from '@mastra/client-js';

type BreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type AggregateRow = AggregateTracesResponse['rows'][number];

const row = (dimensions: AggregateRow['dimensions'], measures: AggregateRow['measures']): AggregateRow => ({
  dimensions,
  measures,
});

/**
 * Agent runs and the traces they ran in, per agent, nested runs included: the busiest agent never
 * starts a trace, and runs 4 times in each one.
 */
export const agentRunsByName: AggregateTracesResponse = {
  rows: [
    row(
      { entityName: 'Explore Subagent' },
      { count: 120, 'countDistinct.traceId': 30, errorCount: 2, errorRate: 2 / 120, 'duration.p95': 900 },
    ),
    row(
      { entityName: 'Code Agent' },
      { count: 40, 'countDistinct.traceId': 20, errorCount: 8, errorRate: 0.2, 'duration.p95': 42_000 },
    ),
    row(
      { entityName: 'Reflector' },
      { count: 10, 'countDistinct.traceId': 5, errorCount: 0, errorRate: 0, 'duration.p95': 3_000 },
    ),
  ],
  truncated: false,
};

/** Tokens and cost per agent; Reflector's model has no price. */
export const agentTokensByName: BreakdownResponse = {
  groups: [
    { dimensions: { entityName: 'Code Agent' }, value: 2_000_000, estimatedCost: 12.5, costUnit: 'USD' },
    { dimensions: { entityName: 'Explore Subagent' }, value: 50_000, estimatedCost: 0.4, costUnit: 'USD' },
    { dimensions: { entityName: 'Reflector' }, value: 3_000, estimatedCost: null, costUnit: null },
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

export const tokensByEnvironment: BreakdownResponse = {
  groups: [{ dimensions: { environment: 'production' }, value: 10_000, estimatedCost: 1, costUnit: 'USD' }],
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
    row(
      { projectId: 'p1', entityName: 'Code Agent' },
      { count: 7, 'countDistinct.traceId': 7, errorCount: 0, errorRate: 0, 'duration.p95': 100 },
    ),
  ],
  truncated: false,
};

/** More tools than the server returns: it keeps the busiest and says so. */
export const truncatedToolCalls: AggregateTracesResponse = { ...toolCallsByName, truncated: true };

/** The same agents over the previous window: Explore Subagent's traces doubled since, Code Agent's errors went up. */
export const previousAgentRunsByName: AggregateTracesResponse = {
  rows: [
    row(
      { entityName: 'Explore Subagent' },
      { count: 60, 'countDistinct.traceId': 15, errorCount: 1, errorRate: 1 / 60, 'duration.p95': 1_000 },
    ),
    row(
      { entityName: 'Code Agent' },
      { count: 40, 'countDistinct.traceId': 20, errorCount: 2, errorRate: 0.05, 'duration.p95': 40_000 },
    ),
  ],
  truncated: false,
};

/** Agent tokens and cost over the previous window: Code Agent spent $5, less than now. */
export const previousAgentUsage: BreakdownResponse = {
  groups: [{ dimensions: { entityName: 'Code Agent' }, value: 1_000_000, estimatedCost: 5, costUnit: 'USD' }],
};

/** Tokens and cost per model. */
export const usageByModel: BreakdownResponse = {
  groups: [
    { dimensions: { model: 'gpt-5' }, value: 2_000_000, estimatedCost: 12, costUnit: 'USD' },
    { dimensions: { model: 'claude-haiku-4-5' }, value: 5_000_000, estimatedCost: 4, costUnit: 'USD' },
  ],
};

/** Model calls per model (counted input-token events): Haiku is called more, for less. */
export const modelSpansByModel: BreakdownResponse = {
  groups: [
    { dimensions: { model: 'claude-haiku-4-5' }, value: 900 },
    { dimensions: { model: 'gpt-5' }, value: 120 },
  ],
};

/** Traces per thread, with the resource each belongs to (project scope). */
export const tracesByThread: AggregateTracesResponse = {
  rows: [
    row({ resourceId: 'user-1', threadId: 'thread-a' }, { count: 30, errorRate: 0.1, 'duration.p95': 5_000 }),
    row({ resourceId: 'user-2', threadId: 'thread-b' }, { count: 5, errorRate: 0, 'duration.p95': 800 }),
  ],
  truncated: false,
};

/** Traces per thread org-wide: grouped by project, so the resource takes its own request. */
export const tracesByProjectAndThread: AggregateTracesResponse = {
  rows: [row({ projectId: 'p1', threadId: 'thread-a' }, { count: 30, errorRate: 0.1, 'duration.p95': 5_000 })],
  truncated: false,
};

export const threadResourcesFixture: AggregateTracesResponse = {
  rows: [row({ resourceId: 'user-1', threadId: 'thread-a' }, { count: 30 })],
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
    row(
      { entityName: 'Retired Agent' },
      { count: 50, 'countDistinct.traceId': 25, errorCount: 0, errorRate: 0, 'duration.p95': 2_000 },
    ),
  ],
  truncated: false,
};
