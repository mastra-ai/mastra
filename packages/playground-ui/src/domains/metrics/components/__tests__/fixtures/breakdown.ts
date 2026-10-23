import type { AggregateTracesResponse, MastraClient } from '@mastra/client-js';

type TimeSeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
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
