import type { SessionDisplayState, SessionRecord } from '@mastra/core/harness/v1';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createHarnessSessionBodySchema } from '../schemas/harness';
import { HARNESS_ROUTES } from '../server-adapter/routes/harness';

import {
  CLOSE_HARNESS_SESSION_ROUTE,
  CREATE_HARNESS_SESSION_ROUTE,
  GET_HARNESS_SESSION_ROUTE,
  LIST_HARNESS_SESSIONS_ROUTE,
} from './harness';

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    harnessName: 'code',
    id: 'session-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    origin: 'top-level',
    ownsThread: true,
    modeId: 'default',
    modelId: 'model-a',
    subagentModelOverrides: {},
    permissionRules: { categories: {}, tools: {} },
    sessionGrants: { categories: [], tools: [] },
    tokenUsage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    pendingQueue: [],
    state: { view: 'open' },
    createdAt: 100,
    lastActivityAt: 200,
    version: 7,
    ...overrides,
  } as SessionRecord;
}

function makeDisplayState(record: SessionRecord): SessionDisplayState {
  return {
    sessionId: record.id,
    threadId: record.threadId,
    resourceId: record.resourceId,
    lifecycleState: record.closedAt !== undefined ? 'closed' : 'live',
    modeId: record.modeId,
    modelId: record.modelId,
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    isRunning: false,
    activeTools: {},
    toolInputBuffers: {},
    activeSubagents: {},
    tokenUsage: record.tokenUsage,
    pending: null,
    queueDepth: record.pendingQueue.length,
  };
}

function makeRequestContext(resourceId = 'resource-1') {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return requestContext;
}

function makeParams(overrides: Record<string, unknown> = {}) {
  return {
    mastra: {},
    requestContext: makeRequestContext(),
    abortSignal: new AbortController().signal,
    ...overrides,
  } as any;
}

async function expectHarnessHttpError(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
    expect.fail('Expected route handler to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(HTTPException);
    const httpError = error as HTTPException;
    expect(httpError.status).toBe(status);
    const body = await httpError.getResponse().json();
    expect(body).toMatchObject({ code });
  }
}

describe('Harness server routes', () => {
  it('registers Harness routes as authenticated Harness client routes', () => {
    expect(HARNESS_ROUTES).toContain(LIST_HARNESS_SESSIONS_ROUTE);
    expect(HARNESS_ROUTES).toContain(CREATE_HARNESS_SESSION_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_SESSION_ROUTE);
    expect(HARNESS_ROUTES).toContain(CLOSE_HARNESS_SESSION_ROUTE);
    expect(LIST_HARNESS_SESSIONS_ROUTE.requiresAuth).toBe(true);
    expect(LIST_HARNESS_SESSIONS_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(CREATE_HARNESS_SESSION_ROUTE.requiresAuth).toBe(true);
    expect(CREATE_HARNESS_SESSION_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(GET_HARNESS_SESSION_ROUTE.requiresAuth).toBe(true);
    expect(GET_HARNESS_SESSION_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(CLOSE_HARNESS_SESSION_ROUTE.requiresAuth).toBe(true);
    expect(CLOSE_HARNESS_SESSION_ROUTE.harnessAuth).toEqual({ clientRoute: true });
  });

  it('lists sessions for the authenticated resource with cursor pagination', async () => {
    const records = [
      makeRecord({ id: 'session-a', lastActivityAt: 300 }),
      makeRecord({ id: 'session-b', lastActivityAt: 250 }),
    ];
    const harness = {
      listSessions: vi.fn(async () => records),
      loadSession: vi.fn(async ({ sessionId }: { sessionId: string }) =>
        records.find(record => record.id === sessionId),
      ),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await LIST_HARNESS_SESSIONS_ROUTE.handler(
      makeParams({ mastra, name: 'code', limit: 1, requestContext: makeRequestContext('resource-1') }),
    );

    expect(harness.listSessions).toHaveBeenCalledWith({ resourceId: 'resource-1', includeClosed: undefined });
    expect(result).toMatchObject({
      items: [{ sessionId: 'session-a', resourceId: 'resource-1', threadId: 'thread-1' }],
      truncated: true,
    });
    expect((result as { nextCursor?: string }).nextCursor).toEqual(expect.any(String));
  });

  it('drops sessions that disappear during list enrichment', async () => {
    const records = [makeRecord({ id: 'session-a' }), makeRecord({ id: 'session-b' })];
    const harness = {
      listSessions: vi.fn(async () => records),
      loadSession: vi.fn(async ({ sessionId }: { sessionId: string }) =>
        sessionId === 'session-a' ? records[0] : null,
      ),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await LIST_HARNESS_SESSIONS_ROUTE.handler(makeParams({ mastra, name: 'code' }));

    expect(result).toMatchObject({
      items: [{ sessionId: 'session-a' }],
      truncated: false,
    });
  });

  it('drops sessions that close during active-only list enrichment', async () => {
    const records = [makeRecord({ id: 'session-a' }), makeRecord({ id: 'session-b' })];
    const harness = {
      listSessions: vi.fn(async () => records),
      loadSession: vi.fn(async ({ sessionId }: { sessionId: string }) =>
        sessionId === 'session-a' ? records[0] : makeRecord({ id: 'session-b', closedAt: 300 }),
      ),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await LIST_HARNESS_SESSIONS_ROUTE.handler(makeParams({ mastra, name: 'code' }));

    expect(result).toMatchObject({
      items: [{ sessionId: 'session-a' }],
      truncated: false,
    });
  });

  it('creates a session with auth-derived resource and returns a snapshot', async () => {
    const record = makeRecord();
    const session = {
      getRecord: () => record,
      getDisplayState: () => makeDisplayState(record),
      getState: vi.fn(async () => record.state),
      listMessages: vi.fn(async () => [{ id: 'message-1', role: 'user', content: 'hello' }]),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await CREATE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', threadId: 'thread-1', resourceId: 'attacker' }),
    );

    expect(harness.session).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
    });
    expect(result).toMatchObject({
      session: {
        summary: { sessionId: 'session-1', resourceId: 'resource-1' },
        state: { view: 'open' },
        messages: { cursor: { threadId: 'thread-1', route: 'thread-messages' } },
      },
    });
  });

  it('rejects create when the requested memory thread belongs to another resource', async () => {
    const harness = { session: vi.fn() };
    const memoryStore = {
      getThreadById: vi.fn(async () => ({ resourceId: 'resource-2' })),
    };
    const mastra = {
      getHarness: vi.fn(() => harness),
      getStorage: vi.fn(() => ({ stores: { memory: memoryStore } })),
    };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', threadId: 'thread-1' })),
      403,
      'harness.permission_denied',
    );
    expect(memoryStore.getThreadById).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('rejects create when a resource-scoped memory lookup hides a foreign thread', async () => {
    const harness = { session: vi.fn() };
    const memoryStore = {
      getThreadById: vi.fn(async (opts: { threadId: string; resourceId?: string }) =>
        opts.resourceId === undefined ? { resourceId: 'resource-2' } : null,
      ),
    };
    const mastra = {
      getHarness: vi.fn(() => harness),
      getStorage: vi.fn(() => ({ stores: { memory: memoryStore } })),
    };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', threadId: 'thread-1' })),
      403,
      'harness.permission_denied',
    );
    expect(memoryStore.getThreadById).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(memoryStore.getThreadById).toHaveBeenCalledWith({ threadId: 'thread-1' });
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('rejects existing session reads when its memory thread is not accessible', async () => {
    const existing = makeRecord({ id: 'session-1', threadId: 'thread-1' });
    const harness = {
      loadSession: vi.fn(async () => existing),
      session: vi.fn(),
    };
    const memoryStore = {
      getThreadById: vi.fn(async () => ({ resourceId: 'resource-2' })),
    };
    const mastra = {
      getHarness: vi.fn(() => harness),
      getStorage: vi.fn(() => ({ stores: { memory: memoryStore } })),
    };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', sessionId: 'session-1' })),
      403,
      'harness.permission_denied',
    );
    expect(memoryStore.getThreadById).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('rejects explicit session ids when the requested thread resolves another active session', async () => {
    const resolvedRecord = makeRecord({ id: 'session-2', threadId: 'thread-1' });
    const session = {
      getRecord: () => resolvedRecord,
      getDisplayState: () => makeDisplayState(resolvedRecord),
      getState: vi.fn(async () => resolvedRecord.state),
      listMessages: vi.fn(async () => []),
    };
    const harness = {
      loadSession: vi.fn(async () => null),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(
        makeParams({ mastra, name: 'code', sessionId: 'session-1', threadId: 'thread-1' }),
      ),
      409,
      'harness.session_conflict',
    );
  });

  it('rejects parent child creation when the requested thread resolves an unrelated session', async () => {
    const parent = makeRecord({ id: 'parent-1' });
    const resolvedRecord = makeRecord({ id: 'session-2', threadId: 'thread-1' });
    const session = {
      getRecord: () => resolvedRecord,
      getDisplayState: () => makeDisplayState(resolvedRecord),
      getState: vi.fn(async () => resolvedRecord.state),
      listMessages: vi.fn(async () => []),
    };
    const harness = {
      loadSession: vi.fn(async () => parent),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(
        makeParams({ mastra, name: 'code', parentSessionId: 'parent-1', threadId: 'thread-1' }),
      ),
      409,
      'harness.session_conflict',
    );
  });

  it('keeps the newest bounded messages in create snapshots', async () => {
    const record = makeRecord();
    const messages = Array.from({ length: 51 }, (_, index) => ({
      id: `message-${index + 1}`,
      role: 'user',
      content: `message ${index + 1}`,
    }));
    const session = {
      getRecord: () => record,
      getDisplayState: () => makeDisplayState(record),
      getState: vi.fn(async () => record.state),
      listMessages: vi.fn(async () => messages),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code' }));
    const recent = (result as any).session.messages.recent;

    expect(session.listMessages).toHaveBeenCalledWith({ limit: 51 });
    expect(recent.messages).toHaveLength(50);
    expect(recent.messages[0]).toMatchObject({ id: 'message-2' });
    expect(recent.messages.at(-1)).toMatchObject({ id: 'message-51' });
    expect(recent.truncated).toBe(true);
    expect(recent.nextCursor).toBeUndefined();
  });

  it('requires parent sessions to belong to the authenticated resource', async () => {
    const parent = makeRecord({ id: 'parent-1', resourceId: 'resource-2' });
    const harness = {
      loadSession: vi.fn(async () => parent),
      session: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', parentSessionId: 'parent-1' })),
      404,
      'harness.session_not_found',
    );
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('rejects explicit create against a closed tenant-owned session id', async () => {
    const closed = makeRecord({ closedAt: 250 });
    const harness = {
      loadSession: vi.fn(async () => closed),
      session: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      CREATE_HARNESS_SESSION_ROUTE.handler(
        makeParams({ mastra, name: 'code', sessionId: 'session-1', threadId: 'thread-1' }),
      ),
      404,
      'harness.session_closed',
    );
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('creates parent-only child requests with a fresh thread resolver', async () => {
    const parent = makeRecord({ id: 'parent-1' });
    const child = makeRecord({ id: 'child-1', parentSessionId: 'parent-1', threadId: 'child-thread' });
    const session = {
      getRecord: () => child,
      getDisplayState: () => makeDisplayState(child),
      getState: vi.fn(async () => child.state),
      listMessages: vi.fn(async () => []),
    };
    const harness = {
      loadSession: vi.fn(async () => parent),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', parentSessionId: 'parent-1' }));

    expect(harness.session).toHaveBeenCalledWith({
      threadId: { fresh: true },
      parentSessionId: 'parent-1',
      resourceId: 'resource-1',
    });
  });

  it('resolves an existing child session id without forcing a new parent thread', async () => {
    const parent = makeRecord({ id: 'parent-1' });
    const child = makeRecord({ id: 'child-1', parentSessionId: 'parent-1', threadId: 'child-thread' });
    const session = {
      getRecord: () => child,
      getDisplayState: () => makeDisplayState(child),
      getState: vi.fn(async () => child.state),
      listMessages: vi.fn(async () => []),
    };
    const harness = {
      loadSession: vi.fn(async ({ sessionId }: { sessionId: string }) => (sessionId === 'child-1' ? child : parent)),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await CREATE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'child-1', parentSessionId: 'parent-1' }),
    );

    expect(harness.session).toHaveBeenCalledWith({
      sessionId: 'child-1',
      resourceId: 'resource-1',
    });
  });

  it('rejects client-declared subagent origins at the body schema', () => {
    expect(createHarnessSessionBodySchema.safeParse({ origin: 'subagent-tool' }).success).toBe(false);
    expect(createHarnessSessionBodySchema.parse({ origin: 'top-level' })).toEqual({ origin: 'top-level' });
  });

  it('returns a session snapshot response with an ETag from the session version', async () => {
    const record = makeRecord();
    const session = {
      getRecord: () => record,
      getDisplayState: () => makeDisplayState(record),
      getState: vi.fn(async () => record.state),
      listMessages: vi.fn(async () => []),
    };
    const harness = {
      loadSession: vi.fn(async () => record),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );
    const body = await response.json();

    expect(response.headers.get('etag')).toBe('"7"');
    expect(harness.session).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      summary: { sessionId: 'session-1', lifecycle: 'active' },
      displayState: { sessionId: 'session-1' },
      tokenUsage: { totalTokens: 3 },
    });
  });

  it('closes only tenant-owned sessions and maps foreign ids to tenant-safe not found', async () => {
    const foreign = makeRecord({ resourceId: 'resource-2' });
    const harness = {
      loadSession: vi.fn(async () => foreign),
      closeSession: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      CLOSE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', sessionId: 'session-1' })),
      404,
      'harness.session_not_found',
    );
    expect(harness.closeSession).not.toHaveBeenCalled();
  });

  it('treats an already closed tenant-owned session close as an idempotent no-op', async () => {
    const closed = makeRecord({ closedAt: 250 });
    const harness = {
      loadSession: vi.fn(async () => closed),
      closeSession: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await CLOSE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );

    expect(response.status).toBe(204);
    expect(harness.closeSession).not.toHaveBeenCalled();
  });

  it('re-enters close for tenant-owned sessions already marked closing', async () => {
    const closing = makeRecord({ closingAt: 250, closeDeadlineAt: 300 });
    const harness = {
      loadSession: vi.fn(async () => closing),
      closeSession: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await CLOSE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );

    expect(response.status).toBe(204);
    expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
  });

  it('treats tenant-owned sessions closing under an active foreign lease as an idempotent no-op', async () => {
    const closing = makeRecord({
      closingAt: Date.now() - 1000,
      closeDeadlineAt: Date.now() + 30000,
      ownerId: 'foreign-owner',
      leaseExpiresAt: Date.now() + 30000,
    });
    const harness = {
      ownerId: 'route-owner',
      loadSession: vi.fn(async () => closing),
      closeSession: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await CLOSE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );

    expect(response.status).toBe(204);
    expect(harness.closeSession).not.toHaveBeenCalled();
  });

  it('passes the authenticated resource to the resource-scoped close path', async () => {
    const record = makeRecord();
    const harness = {
      loadSession: vi.fn(async () => record),
      closeSession: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await CLOSE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );

    expect(response.status).toBe(204);
    expect(harness.closeSession).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
  });
});
