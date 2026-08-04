import { describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../../../observability/types';
import { InMemoryStore } from '../../mock';

function makeRootSpan(traceId: string, startedAt: Date) {
  return {
    traceId,
    spanId: `${traceId}-root`,
    parentSpanId: null,
    name: 'agent-run',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    entityType: EntityType.AGENT,
    entityId: 'agent-1',
    entityName: 'myAgent',
    userId: null,
    organizationId: null,
    resourceId: null,
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    environment: 'test',
    source: null,
    serviceName: 'test-service',
    scope: null,
    attributes: {},
    metadata: {},
    tags: [],
    links: null,
    input: { messages: [{ role: 'user', content: 'summarize this thread' }] },
    output: { text: 'a long answer' },
    error: null,
    startedAt,
    endedAt: null,
  } as any;
}

const T0 = new Date('2026-01-01T00:00:00.000Z');

describe('ObservabilityInMemory listTracesLight', () => {
  it('returns light rows with inputPreview in page mode', async () => {
    const store = new InMemoryStore();
    const obs = (await store.getStore('observability'))!;
    await obs.createSpan({ span: makeRootSpan('trace-A', T0) });

    const result = await obs.listTracesLight({ pagination: { page: 0, perPage: 10 } });

    expect(result.pagination).toEqual({ total: 1, page: 0, perPage: 10, hasMore: false });
    expect(result.spans).toHaveLength(1);
    const row = result.spans[0]! as Record<string, unknown>;
    expect(row.traceId).toBe('trace-A');
    expect(row.input).toBeUndefined();
    expect(row.output).toBeUndefined();
    expect(row.inputPreview).toBe('summarize this thread');
  });

  it('returns delta metadata and light rows in delta mode', async () => {
    const store = new InMemoryStore();
    const obs = (await store.getStore('observability'))!;

    const bootstrap = await obs.listTracesLight({ mode: 'delta' });
    expect(bootstrap.spans).toEqual([]);
    expect(bootstrap.deltaCursor).toBeDefined();

    await obs.createSpan({ span: makeRootSpan('trace-A', T0) });

    const poll = await obs.listTracesLight({ mode: 'delta', after: bootstrap.deltaCursor });
    expect(poll.delta).toEqual(expect.objectContaining({ hasMore: false }));
    expect(poll.deltaCursor).toBeDefined();
    expect(poll.spans.map(s => s.traceId)).toEqual(['trace-A']);
    const row = poll.spans[0]! as Record<string, unknown>;
    expect(row.input).toBeUndefined();
    expect(row.inputPreview).toBe('summarize this thread');
  });
});
