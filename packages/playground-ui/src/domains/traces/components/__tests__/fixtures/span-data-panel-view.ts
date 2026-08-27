import type { RouteResponse } from '@mastra/client-js';
import { SpanType } from '@mastra/core/observability';

type SpanRecord = RouteResponse<'GET /observability/traces/:traceId/spans/:spanId'>['span'];

export const spanFixture: SpanRecord = {
  traceId: 'trace-1',
  spanId: 'span-1',
  parentSpanId: null,
  name: 'agent run',
  entityType: null,
  entityId: null,
  entityName: null,
  userId: null,
  organizationId: null,
  resourceId: null,
  runId: null,
  sessionId: null,
  threadId: null,
  requestId: null,
  environment: null,
  source: null,
  serviceName: null,
  scope: null,
  spanType: SpanType.AGENT_RUN,
  attributes: null,
  metadata: null,
  tags: null,
  links: null,
  input: null,
  output: null,
  error: null,
  requestContext: null,
  isEvent: false,
  startedAt: new Date('2026-06-01T10:00:00.000Z'),
  endedAt: new Date('2026-06-01T10:00:01.000Z'),
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  updatedAt: null,
};
