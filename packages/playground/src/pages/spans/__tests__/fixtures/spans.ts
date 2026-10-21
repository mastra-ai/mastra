import type { GetObservabilityCapabilitiesResponse, QuerySpansResult } from '@mastra/client-js';

type SpanRow = QuerySpansResult['spans'][number];

export const spanQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageDuckDB',
  capabilities: {
    metrics: true,
    logs: true,
    discovery: {
      entityTypes: true,
      entityNames: true,
      serviceNames: true,
      environments: true,
      tags: true,
      metrics: true,
    },
    deltaPolling: true,
    traceQuery: true,
    traceQueryRootDuration: true,
    traceQueryDiscovery: true,
    traceQueryTenantScope: true,
    threadQuery: true,
    spanQuery: true,
    feedback: true,
  },
};

export const noSpanQueryCapabilities: GetObservabilityCapabilitiesResponse = {
  observabilityStorageType: 'ObservabilityStorageLibSQL',
  capabilities: {
    ...spanQueryCapabilities.capabilities,
    traceQuery: false,
    traceQueryRootDuration: false,
    traceQueryDiscovery: false,
    traceQueryTenantScope: false,
    threadQuery: false,
    spanQuery: false,
  },
};

function makeSpan(overrides: Partial<SpanRow> & Pick<SpanRow, 'traceId' | 'spanId' | 'name'>): SpanRow {
  return {
    organizationId: null,
    resourceId: null,
    parentSpanId: null,
    spanType: 'agent_run',
    status: 'success',
    startedAt: '2026-10-21T08:00:00.000Z',
    endedAt: '2026-10-21T08:00:01.000Z',
    durationMs: 1000,
    entityType: 'agent',
    entityId: 'weather-agent',
    entityName: 'Weather Agent',
    entityVersionId: null,
    parentEntityType: null,
    parentEntityId: null,
    parentEntityName: null,
    parentEntityVersionId: null,
    rootEntityType: null,
    rootEntityId: null,
    rootEntityName: null,
    rootEntityVersionId: null,
    threadId: null,
    runId: null,
    sessionId: null,
    userId: null,
    requestId: null,
    serviceName: null,
    experimentId: null,
    environment: null,
    executionSource: null,
    model: null,
    provider: null,
    inputPreview: null,
    outputPreview: null,
    errorPreview: null,
    ...overrides,
  };
}

export const SPANS_PAGE_TWO_CURSOR = 'cursor-page-two';

export const spansFirstPage: QuerySpansResult = {
  spans: [
    makeSpan({
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'agent run: weather',
      entityName: 'Weather Agent',
    }),
    makeSpan({
      traceId: 'trace-1',
      spanId: 'span-2',
      parentSpanId: 'span-1',
      name: 'tool: get-weather',
      spanType: 'tool_call',
      entityType: 'tool',
      entityId: 'get-weather',
      entityName: 'Get Weather Tool',
    }),
  ],
  page: { next: SPANS_PAGE_TWO_CURSOR },
};

export const spansLastPage: QuerySpansResult = {
  spans: [
    makeSpan({
      traceId: 'trace-2',
      spanId: 'span-3',
      name: 'workflow run: onboarding',
      spanType: 'workflow_run',
      entityType: 'workflow_run',
      entityId: 'onboarding',
      entityName: 'Onboarding Workflow',
    }),
  ],
  page: { next: null },
};

export const emptySpans: QuerySpansResult = { spans: [], page: { next: null } };
