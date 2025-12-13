import { randomUUID } from 'node:crypto';
import { SpanType, EntityType } from '@mastra/core/observability';
import type { CreateSpanRecord, SpanRecord } from '@mastra/core/storage';

/**
 * Default base date for testing - can be overridden
 */
export const DEFAULT_BASE_DATE = new Date('2024-01-01T00:00:00Z');

/**
 * Creates a span record for testing with sensible defaults.
 * All fields can be overridden via the overrides parameter.
 */
export function createSpan(overrides: Partial<CreateSpanRecord> = {}): CreateSpanRecord {
  const baseDate = overrides.startedAt || DEFAULT_BASE_DATE;
  const traceId = overrides.traceId || `trace-${randomUUID()}`;
  const spanId = overrides.spanId || `span-${randomUUID()}`;

  return {
    traceId,
    spanId,
    parentSpanId: null,
    name: 'Test Span',
    spanType: SpanType.AGENT_RUN,
    entityType: EntityType.AGENT,
    entityId: 'agent-1',
    entityName: 'Test Agent',
    userId: null,
    organizationId: null,
    resourceId: null,
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    environment: 'test',
    source: 'local',
    serviceName: 'test-service',
    scope: null,
    attributes: null,
    metadata: null,
    tags: null,
    links: null,
    input: null,
    output: null,
    error: null,
    isEvent: false,
    startedAt: baseDate,
    endedAt: new Date(baseDate.getTime() + 1000),
    ...overrides,
  };
}

/**
 * Creates a root span (no parent) for testing.
 * This is a convenience wrapper around createSpan.
 */
export function createRootSpan(overrides: Partial<CreateSpanRecord> = {}): CreateSpanRecord {
  return createSpan({
    parentSpanId: null,
    ...overrides,
  });
}

/**
 * Creates a child span with a specified parent span ID.
 * This is a convenience wrapper around createSpan.
 */
export function createChildSpan(parentSpanId: string, overrides: Partial<CreateSpanRecord> = {}): CreateSpanRecord {
  return createSpan({
    parentSpanId,
    ...overrides,
  });
}

// Re-export types and enums for convenience
export { SpanType, EntityType };
export type { CreateSpanRecord, SpanRecord };
