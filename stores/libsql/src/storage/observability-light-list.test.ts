/**
 * LibSQL has no dedicated `listTracesLight` implementation, so it exercises the
 * base-class projection fallback. That path is what the Studio traces list runs on
 * for the default local store, so it is covered here against a real database rather
 * than a mock.
 */
import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { LibSQLStore } from './index';

function createStore() {
  return new LibSQLStore({ id: `light-list-${Math.random().toString(36).slice(2)}`, url: ':memory:' });
}

const rootSpan = {
  traceId: 'light-trace-1',
  spanId: 'light-span-1',
  parentSpanId: null,
  name: 'agent run',
  spanType: SpanType.AGENT_RUN,
  isEvent: false,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  endedAt: new Date('2026-01-01T00:00:05Z'),
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
  links: null,
  metadata: null,
  tags: [],
  error: null,
  attributes: { model: 'claude-sonnet-4-6' },
  input: { messages: [{ role: 'user', content: 'summarize this thread' }] },
  output: { text: 'y'.repeat(20_000) },
};

describe('listTracesLight on a store without a dedicated implementation', () => {
  it('returns rows carrying a preview instead of the input/output/attributes blobs', async () => {
    const store = createStore();
    await store.init();
    await store.stores.observability.batchCreateSpans({ records: [rootSpan] });

    const result = await store.stores.observability.listTracesLight({ pagination: { page: 0, perPage: 10 } });

    expect(result.spans).toHaveLength(1);
    const row = result.spans[0]! as Record<string, unknown>;
    expect(row.traceId).toBe('light-trace-1');
    expect(row.input).toBeUndefined();
    expect(row.output).toBeUndefined();
    expect(row.attributes).toBeUndefined();
    expect(row.inputPreview).toBe('summarize this thread');
  });

  it('keeps the pagination metadata callers page with', async () => {
    const store = createStore();
    await store.init();
    await store.stores.observability.batchCreateSpans({ records: [rootSpan] });

    const result = await store.stores.observability.listTracesLight({ pagination: { page: 0, perPage: 10 } });

    expect(result.pagination).toMatchObject({ total: 1, page: 0, perPage: 10, hasMore: false });
  });
});
