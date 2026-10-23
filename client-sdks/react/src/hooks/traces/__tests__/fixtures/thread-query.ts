import type { QueryTraceThreadsResult } from '@mastra/client-js';

type ThreadRow = QueryTraceThreadsResult['threads'][number];

function makeThread(
  overrides: Partial<ThreadRow> & Pick<ThreadRow, 'threadId' | 'firstTraceId' | 'lastTraceId'>,
): ThreadRow {
  return {
    organizationId: 'org-1',
    resourceId: null,
    userId: null,
    entityType: 'agent',
    entityId: 'weather-agent',
    entityName: 'Weather Agent',
    entityVersionId: null,
    runId: null,
    sessionId: null,
    requestId: null,
    serviceName: null,
    experimentId: null,
    environment: null,
    executionSource: null,
    status: 'success',
    startedAt: '2026-10-21T08:00:00.000Z',
    endedAt: '2026-10-21T08:05:00.000Z',
    timeToFirstChunkMs: null,
    inputPreview: null,
    outputPreview: null,
    errorPreview: null,
    traceCount: 2,
    model: null,
    provider: null,
    ...overrides,
  };
}

export const THREAD_PAGE_ONE_CURSOR = 'thread-cursor-page-two';

export const threadQueryFirstPage: QueryTraceThreadsResult = {
  threads: [
    makeThread({ threadId: 'thread-1', firstTraceId: 'trace-1a', lastTraceId: 'trace-1b' }),
    makeThread({ threadId: 'thread-2', firstTraceId: 'trace-2a', lastTraceId: 'trace-2b', traceCount: 4 }),
  ],
  page: { next: THREAD_PAGE_ONE_CURSOR },
};

export const threadQueryLastPage: QueryTraceThreadsResult = {
  threads: [
    makeThread({
      threadId: 'thread-3',
      firstTraceId: 'trace-3a',
      lastTraceId: 'trace-3a',
      traceCount: 1,
      status: 'error',
    }),
  ],
  page: { next: null },
};
