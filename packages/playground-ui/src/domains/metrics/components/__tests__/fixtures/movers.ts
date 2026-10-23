import type { AggregateSpansResponse, AggregateTracesResponse, MastraClient } from '@mastra/client-js';

type SeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
type BreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const entity = (spanType: string, entityName: string, count: number, errorRate: number, p95: number) => ({
  dimensions: { spanType, entityName },
  measures: { count, errorRate, 'duration.p95': p95 },
});

/** This window's agent and workflow runs: Code Agent tripled, Fresh is new. */
export const currentEntityRuns: AggregateSpansResponse = {
  rows: [
    entity('agent_run', 'Observer', 1000, 0.1, 2000),
    entity('agent_run', 'Code Agent', 400, 0.07, 1000),
    entity('workflow_run', 'ingest', 30, 0, 500),
    entity('agent_run', 'Fresh', 5, 0, 100),
  ],
  truncated: false,
};

/** The previous window's: ingest ran twice as often. */
export const previousEntityRuns: AggregateSpansResponse = {
  rows: [
    entity('agent_run', 'Observer', 900, 0.1, 2000),
    entity('agent_run', 'Code Agent', 100, 0.02, 1000),
    entity('workflow_run', 'ingest', 60, 0, 500),
  ],
  truncated: false,
};

/** This window's agent spend: Code Agent cost $12.50. */
export const currentAgentCost: SeriesResponse = {
  series: [
    {
      name: 'Code Agent',
      costUnit: 'USD',
      points: [{ timestamp: new Date(), value: 1000, estimatedCost: 12.5 }],
    },
  ],
};

/** The previous window's: $2.50. */
export const previousAgentCost: BreakdownResponse = {
  groups: [{ dimensions: { entityName: 'Code Agent' }, value: 200, estimatedCost: 2.5, costUnit: 'USD' }],
};

/** An error rate that moved by 0.02 points. */
export const tinyErrorRateChange: { current: AggregateSpansResponse; previous: AggregateSpansResponse } = {
  current: { rows: [entity('agent_run', 'Busy', 100_000, 0.0003, 100)], truncated: false },
  previous: { rows: [entity('agent_run', 'Busy', 100_000, 0.0001, 100)], truncated: false },
};

const project = (projectId: string, count: number) => ({
  dimensions: { projectId },
  measures: { count, errorRate: 0, 'duration.p95': 100, 'countDistinct.resourceId': 1, 'countDistinct.threadId': 1 },
});

/** Traces per project, this window and the previous one: p2 grew most. */
export const currentProjectTraces: AggregateTracesResponse = {
  rows: [project('p1', 110), project('p2', 500)],
  truncated: false,
};
export const previousProjectTraces: AggregateTracesResponse = {
  rows: [project('p1', 100), project('p2', 200)],
  truncated: false,
};
