import type {
  GetAgentResponse,
  GetObservabilityCapabilitiesResponse,
  GetScorersResponse,
  GetSystemPackagesResponse,
  MastraClient,
} from '@mastra/client-js';
import type { TraceAggregateResponse } from '@mastra/core/storage';
import { agentsList } from './agents';

type Breakdown = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;
type TimeSeries = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;
type Aggregate = Awaited<ReturnType<MastraClient['getMetricAggregate']>>;
type ScoreBreakdown = Awaited<ReturnType<MastraClient['getScoreBreakdown']>>;

const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

export const threeAgents: Record<string, GetAgentResponse> = {
  ...agentsList,
  writer: { ...agentsList.analyst, id: 'writer', name: 'Writer Agent', modelId: 'gpt-4o' },
};

export const observabilityOn: GetSystemPackagesResponse = {
  packages: [{ name: '@mastra/observability', version: '1.0.0' }],
  isDev: true,
  cmsEnabled: false,
  observabilityEnabled: true,
};

export const observabilityOff: GetSystemPackagesResponse = { ...observabilityOn, observabilityEnabled: false };

export const storageWithMetrics: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: { metrics: true, logs: true, traceQueryDiscovery: false },
};

export const currentAgentRuns: Breakdown = {
  groups: [
    { dimensions: { entityId: 'writer', status: 'ok' }, value: 20 },
    { dimensions: { entityId: 'researcher', status: 'ok' }, value: 6 },
    { dimensions: { entityId: 'researcher', status: 'error' }, value: 4 },
  ],
};

export const previousAgentRunsWithFewerErrors: Breakdown = {
  groups: [
    { dimensions: { entityId: 'writer', status: 'ok' }, value: 18 },
    { dimensions: { entityId: 'researcher', status: 'ok' }, value: 9 },
    { dimensions: { entityId: 'researcher', status: 'error' }, value: 1 },
  ],
};

export const agentRunsOverTime: TimeSeries = {
  series: [
    { name: 'writer|ok', points: [{ timestamp: anHourAgo, value: 20 }] },
    { name: 'researcher|ok', points: [{ timestamp: anHourAgo, value: 6 }] },
    { name: 'researcher|error', points: [{ timestamp: anHourAgo, value: 4 }] },
  ],
};

export const tokensByAgent: Breakdown = {
  groups: [
    { dimensions: { entityId: 'writer' }, value: 3000, estimatedCost: 0.3, costUnit: 'USD' },
    { dimensions: { entityId: 'researcher' }, value: 1000, estimatedCost: 0.1, costUnit: 'USD' },
  ],
};

export const tokenTotals: Aggregate = {
  value: 4000,
  previousValue: 2000,
  changePercent: 100,
  estimatedCost: 0.4,
  previousEstimatedCost: 0.2,
  costChangePercent: 100,
  costUnit: 'USD',
};

export const agentLatencyByName: TraceAggregateResponse = {
  rows: [
    { dimensions: { entityType: 'agent', entityName: 'Writer Agent' }, measures: { 'duration.p95': 1200 } },
    { dimensions: { entityType: 'agent', entityName: 'Research Agent' }, measures: { 'duration.p95': 800 } },
  ],
  truncated: false,
};

export const agentLatencyTotal: TraceAggregateResponse = {
  rows: [
    { dimensions: { entityType: 'workflow_run' }, measures: { 'duration.p95': 4000 } },
    { dimensions: { entityType: 'agent' }, measures: { 'duration.p95': 1100 } },
  ],
  truncated: false,
};

export const noScorers: GetScorersResponse = {};

export const qualityScorer: GetScorersResponse = {
  quality: {
    scorer: { config: { id: 'quality', name: 'Quality', description: 'Measures response quality' } },
    agentIds: [],
    agentNames: [],
    workflowIds: [],
    isRegistered: true,
    source: 'code',
  },
};

export const currentQuality: ScoreBreakdown = { groups: [{ dimensions: { entityId: 'writer' }, value: 0.7 }] };

export const previousQuality: ScoreBreakdown = { groups: [{ dimensions: { entityId: 'writer' }, value: 0.9 }] };
