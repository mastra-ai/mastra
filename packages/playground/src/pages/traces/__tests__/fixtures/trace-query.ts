import type { GetTraceQueryFieldsResponse, GetTraceQueryValuesResponse, MastraClient } from '@mastra/client-js';

export const emptyTraceQueryFields: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [],
  observedFieldsTruncated: false,
};

export const traceQueryFieldsWithRegion: GetTraceQueryFieldsResponse = {
  canonicalFields: [],
  observedFields: [
    {
      path: 'metadata.region',
      valueKind: 'string',
      operators: ['eq', 'ne', 'in', 'notIn', 'exists', 'notExists'],
      valueSuggestions: true,
      occurrences: 12,
    },
  ],
  observedFieldsTruncated: false,
};

export const traceQueryRegionValues: GetTraceQueryValuesResponse = {
  values: [
    { value: 'eu-west', count: 8 },
    { value: 'us-east', count: 4 },
  ],
  valuesTruncated: false,
};

export const traceQueryPage: Awaited<ReturnType<MastraClient['queryTraces']>> = {
  traces: [
    {
      traceId: 'trace-a',
      rootSpanId: 'span-a',
      name: 'Studio preview agent',
      createdAt: '2026-09-15T12:00:00.000Z',
      startedAt: '2026-09-15T12:00:00.000Z',
      endedAt: '2026-09-15T12:00:01.000Z',
      status: 'success',
      entityId: null,
      entityName: null,
      entityType: null,
      environment: null,
      parentSpanId: null,
      metadata: null,
      inputPreview: null,
      threadId: null,
      resourceId: null,
    },
  ],
  page: { next: null },
};
