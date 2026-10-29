import type { QuerySpansResult } from '@mastra/client-js';

type SpanRow = QuerySpansResult['spans'][number];

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

export const SPAN_PAGE_ONE_CURSOR = 'cursor-page-two';

export const spanQueryFirstPage: QuerySpansResult = {
  spans: [
    makeSpan({ traceId: 'trace-1', spanId: 'span-1', name: 'agent run: weather' }),
    makeSpan({
      traceId: 'trace-1',
      spanId: 'span-2',
      parentSpanId: 'span-1',
      name: 'tool: get-weather',
      spanType: 'tool_call',
    }),
  ],
  page: { next: SPAN_PAGE_ONE_CURSOR },
};

export const spanQueryLastPage: QuerySpansResult = {
  spans: [
    makeSpan({ traceId: 'trace-2', spanId: 'span-3', name: 'workflow run: onboarding', spanType: 'workflow_run' }),
  ],
  page: { next: null },
};
