import { randomUUID } from 'crypto';
import { AISpanType } from '@mastra/core/ai-tracing';
import type { AISpanRecord } from '@mastra/core/storage';

export function createSampleAISpanForDB({
  name,
  scope,
  traceId,
  parentSpanId,
  startedAt,
  endedAt,
  spanType,
}: {
  name: string;
  scope: string;
  traceId?: string;
  parentSpanId?: string | null;
  startedAt?: Date;
  endedAt?: Date;
  spanType?: AISpanType;
}): AISpanRecord {
  const now = startedAt || new Date();
  const end = endedAt || new Date(now.getTime() + 1000); // 1 second later
  const generatedTraceId = traceId || `test-trace-${randomUUID()}`;
  const spanId = `test-span-${randomUUID()}`;

  return {
    traceId: generatedTraceId,
    spanId,
    parentSpanId: parentSpanId || null, // null for root spans, parentSpanId for child spans
    name,
    scope: {
      version: '1.0.0',
      environment: 'test',
    },
    spanType: spanType || AISpanType.GENERIC,
    attributes: {
      tokenUsage: 100,
    },
    metadata: {
      runId: `run-${randomUUID()}`,
    },
    links: null,
    startedAt: now,
    endedAt: end,
    createdAt: now,
    updatedAt: null,
    input: [{ role: 'user', content: 'test input' }],
    output: [{ role: 'assistant', content: 'test output' }],
    error: null,
  };
}

/**
 * Creates a root span (no parent) for testing
 */
export function createRootSpan(
  {
    name,
    scope,
    traceId,
    startedAt,
    endedAt,
    spanType,
  }: {
    name: string;
    scope: string;
    traceId?: string;
    startedAt?: Date;
    endedAt?: Date;
    spanType?: AISpanType;
  } = {
    name: 'test-root-span',
    scope: 'test-scope',
  },
): AISpanRecord {
  return createSampleAISpanForDB({
    name,
    scope,
    traceId,
    parentSpanId: null,
    startedAt,
    endedAt,
    spanType,
  });
}

/**
 * Creates a child span with a specified parent span ID
 */
export function createChildSpan({
  name,
  scope,
  parentSpanId,
  traceId,
  startedAt,
  endedAt,
}: {
  name: string;
  scope: string;
  parentSpanId: string;
  traceId?: string;
  startedAt?: Date;
  endedAt?: Date;
}): AISpanRecord {
  return createSampleAISpanForDB({
    name,
    scope,
    traceId,
    parentSpanId,
    startedAt,
    endedAt,
  });
}
