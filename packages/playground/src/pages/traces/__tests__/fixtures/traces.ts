import type { GetScoresScorers_Response, GetSystemPackagesResponse, MastraClient } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';
import { TraceStatus } from '@mastra/core/storage';

type ListTracesResponse = Awaited<ReturnType<MastraClient['listTraces']>>;
type ListBranchesResponse = Awaited<ReturnType<MastraClient['listBranches']>>;
type MetricBreakdownResponse = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const baseSystemPackages: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: true,
};

export const metricsCapableSystemPackages: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
  observabilityStorageCapabilities: { metrics: true, logs: true },
};

export const metricsUnavailableSystemPackages: GetSystemPackagesResponse = {
  ...baseSystemPackages,
  observabilityStorageType: 'ObservabilityStoragePostgresVNext',
  observabilityStorageCapabilities: { metrics: false, logs: true },
};

const trace = {
  traceId: 'trace-a',
  spanId: 'span-a',
  name: 'Studio preview agent',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-07-31T12:00:00.000Z'),
  endedAt: new Date('2026-07-31T12:00:01.000Z'),
  createdAt: new Date('2026-07-31T12:00:00.000Z'),
  updatedAt: null,
  status: TraceStatus.SUCCESS,
};

export const traceList: ListTracesResponse = {
  spans: [trace],
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
};

export const branchList: ListBranchesResponse = {
  branches: [{ ...trace, parentSpanId: 'root-span' }],
  pagination: { total: 1, page: 0, perPage: 25, hasMore: false },
};

export const traceUsageBreakdown: MetricBreakdownResponse = {
  groups: [
    {
      dimensions: { traceId: 'trace-a', name: 'mastra_model_total_input_tokens' },
      value: 100,
      estimatedCost: 0.001,
      costUnit: 'usd',
    },
  ],
};

export const emptyScorers: GetScoresScorers_Response = {};
export const emptyTags: Awaited<ReturnType<MastraClient['getTags']>> = { tags: [] };
export const emptyEntityNames: Awaited<ReturnType<MastraClient['getEntityNames']>> = { entityNames: [] };
export const emptyServiceNames: Awaited<ReturnType<MastraClient['getServiceNames']>> = { serviceNames: [] };
export const emptyEnvironments: Awaited<ReturnType<MastraClient['getEnvironments']>> = { environments: [] };
