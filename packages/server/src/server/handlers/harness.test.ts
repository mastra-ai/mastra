import type { SessionDisplayState, SessionRecord } from '@mastra/core/harness/v1';
import { HarnessAttachmentUnavailableError, HarnessInboxResponseConflictError } from '@mastra/core/harness/v1';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import { createHarnessSessionBodySchema } from '../schemas/harness';
import { HARNESS_ROUTES } from '../server-adapter/routes/harness';

import {
  CLOSE_HARNESS_SESSION_ROUTE,
  CREATE_HARNESS_SESSION_ROUTE,
  DELETE_HARNESS_GOAL_ROUTE,
  GET_HARNESS_GOAL_ROUTE,
  GET_HARNESS_SESSION_ROUTE,
  GET_HARNESS_STATE_ROUTE,
  LIST_HARNESS_SESSIONS_ROUTE,
  PATCH_HARNESS_MODE_ROUTE,
  PATCH_HARNESS_MODEL_ROUTE,
  PATCH_HARNESS_PERMISSIONS_ROUTE,
  PATCH_HARNESS_STATE_ROUTE,
  PAUSE_HARNESS_GOAL_ROUTE,
  POST_HARNESS_MESSAGE_ROUTE,
  POST_HARNESS_QUEUE_ROUTE,
  PUT_HARNESS_GOAL_ROUTE,
  RESPOND_HARNESS_INBOX_ROUTE,
  RESUME_HARNESS_GOAL_ROUTE,
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
    expect(HARNESS_ROUTES).toContain(POST_HARNESS_MESSAGE_ROUTE);
    expect(HARNESS_ROUTES).toContain(POST_HARNESS_QUEUE_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_STATE_ROUTE);
    expect(HARNESS_ROUTES).toContain(PATCH_HARNESS_STATE_ROUTE);
    expect(HARNESS_ROUTES).toContain(PATCH_HARNESS_MODE_ROUTE);
    expect(HARNESS_ROUTES).toContain(PATCH_HARNESS_MODEL_ROUTE);
    expect(HARNESS_ROUTES).toContain(PATCH_HARNESS_PERMISSIONS_ROUTE);
    expect(HARNESS_ROUTES).toContain(RESPOND_HARNESS_INBOX_ROUTE);
    expect(HARNESS_ROUTES).toContain(PUT_HARNESS_GOAL_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_GOAL_ROUTE);
    expect(HARNESS_ROUTES).toContain(PAUSE_HARNESS_GOAL_ROUTE);
    expect(HARNESS_ROUTES).toContain(RESUME_HARNESS_GOAL_ROUTE);
    expect(HARNESS_ROUTES).toContain(DELETE_HARNESS_GOAL_ROUTE);
    expect(HARNESS_ROUTES).toContain(CLOSE_HARNESS_SESSION_ROUTE);
    expect(LIST_HARNESS_SESSIONS_ROUTE.requiresAuth).toBe(true);
    expect(LIST_HARNESS_SESSIONS_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(CREATE_HARNESS_SESSION_ROUTE.requiresAuth).toBe(true);
    expect(CREATE_HARNESS_SESSION_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(GET_HARNESS_SESSION_ROUTE.requiresAuth).toBe(true);
    expect(GET_HARNESS_SESSION_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(POST_HARNESS_MESSAGE_ROUTE.requiresAuth).toBe(true);
    expect(POST_HARNESS_MESSAGE_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(POST_HARNESS_QUEUE_ROUTE.requiresAuth).toBe(true);
    expect(POST_HARNESS_QUEUE_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(PATCH_HARNESS_STATE_ROUTE.requiresAuth).toBe(true);
    expect(PATCH_HARNESS_STATE_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(RESPOND_HARNESS_INBOX_ROUTE.requiresAuth).toBe(true);
    expect(RESPOND_HARNESS_INBOX_ROUTE.harnessAuth).toEqual({ clientRoute: true });
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
      makeParams({
        mastra,
        name: 'query-code',
        requestPathParams: { name: 'code' },
        requestBody: { threadId: 'thread-1' },
        resourceId: 'attacker',
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
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

  it('ignores create options supplied only through flattened query params', async () => {
    const record = makeRecord();
    const session = {
      getRecord: () => record,
      getDisplayState: () => makeDisplayState(record),
      getState: vi.fn(async () => record.state),
      listMessages: vi.fn(async () => []),
    };
    const harness = {
      loadSession: vi.fn(),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await CREATE_HARNESS_SESSION_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        requestPathParams: { name: 'code' },
        sessionId: 'query-session',
        threadId: 'query-thread',
        parentSessionId: 'query-parent',
        origin: 'subagent-tool',
        modeId: 'query-mode',
        modelId: 'query-model',
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.loadSession).not.toHaveBeenCalled();
    expect(harness.session).toHaveBeenCalledWith({ resourceId: 'resource-1' });
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
      CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', requestBody: { threadId: 'thread-1' } })),
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
      CREATE_HARNESS_SESSION_ROUTE.handler(makeParams({ mastra, name: 'code', requestBody: { threadId: 'thread-1' } })),
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
      CREATE_HARNESS_SESSION_ROUTE.handler(
        makeParams({ mastra, name: 'code', requestBody: { sessionId: 'session-1' } }),
      ),
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
        makeParams({ mastra, name: 'code', requestBody: { sessionId: 'session-1', threadId: 'thread-1' } }),
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
        makeParams({ mastra, name: 'code', requestBody: { parentSessionId: 'parent-1', threadId: 'thread-1' } }),
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
      CREATE_HARNESS_SESSION_ROUTE.handler(
        makeParams({ mastra, name: 'code', requestBody: { parentSessionId: 'parent-1' } }),
      ),
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
        makeParams({ mastra, name: 'code', requestBody: { sessionId: 'session-1', threadId: 'thread-1' } }),
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

    await CREATE_HARNESS_SESSION_ROUTE.handler(
      makeParams({ mastra, name: 'code', requestBody: { parentSessionId: 'parent-1' } }),
    );

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
      makeParams({ mastra, name: 'code', requestBody: { sessionId: 'child-1', parentSessionId: 'parent-1' } }),
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
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
      }),
    );
    const body = await response.json();

    expect(response.headers.get('etag')).toBe('"7"');
    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.loadSession).toHaveBeenCalledWith({ sessionId: 'session-1', includeClosed: true });
    expect(harness.session).not.toHaveBeenCalled();
    expect(body).toMatchObject({
      summary: { sessionId: 'session-1', lifecycle: 'active' },
      displayState: { sessionId: 'session-1' },
      tokenUsage: { totalTokens: 3 },
    });
  });

  it('reads session state with a session ETag', async () => {
    const record = makeRecord({ state: { view: 'open' }, version: 11 });
    const harness = {
      loadSession: vi.fn(async () => record),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_STATE_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
      }),
    );

    expect(response.headers.get('etag')).toBe('"11"');
    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.loadSession).toHaveBeenCalledWith({ sessionId: 'session-1', includeClosed: true });
    await expect(response.json()).resolves.toEqual({ view: 'open' });
  });

  it('admits a message without awaiting its eventual result', async () => {
    const session = {
      admitMessage: vi.fn(async () => ({
        accepted: true as const,
        signalId: 'signal-1',
        runId: 'run-1',
        duplicate: false,
      })),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await POST_HARNESS_MESSAGE_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
        requestBody: {
          content: 'hello',
          admissionId: 'admission-1',
          mode: 'default',
        },
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
    expect(session.admitMessage).toHaveBeenCalledWith({
      content: 'hello',
      admissionId: 'admission-1',
      mode: 'default',
    });
    expect(result).toEqual({ accepted: true, signalId: 'signal-1', runId: 'run-1', duplicate: false });
  });

  it('rejects mutation payloads supplied only through flattened query params', async () => {
    const session = {
      admitMessage: vi.fn(),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_MESSAGE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          content: 'query-content',
          admissionId: 'query-admission',
        }),
      ),
      400,
      'harness.validation',
    );
    expect(harness.session).not.toHaveBeenCalled();
    expect(session.admitMessage).not.toHaveBeenCalled();
  });

  it('admits a queued turn without awaiting its eventual result', async () => {
    const session = {
      admitQueue: vi.fn(async () => ({
        accepted: true as const,
        queuedItemId: 'queue-1',
        duplicate: true,
      })),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await POST_HARNESS_QUEUE_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
        requestBody: {
          content: 'next',
          admissionId: 'admission-queue-1',
          yolo: true,
        },
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
    expect(session.admitQueue).toHaveBeenCalledWith({
      content: 'next',
      admissionId: 'admission-queue-1',
      yolo: true,
    });
    expect(result).toEqual({ accepted: true, queuedItemId: 'queue-1', duplicate: true });
  });

  it('maps queue attachment admission failures to client-actionable errors', async () => {
    const session = {
      admitQueue: vi.fn(async () => {
        throw new HarnessAttachmentUnavailableError('session-1', 'digest_mismatch', 'attachment-1');
      }),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_QUEUE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            content: 'next',
            admissionId: 'admission-queue-1',
            attachments: [{ attachmentId: 'attachment-1', resourceId: 'resource-1' }],
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );
  });

  it('patches session state only when If-Match matches the stored version', async () => {
    const record = makeRecord({ state: { view: 'open' }, version: 7 });
    const session = {
      getRecord: () => record,
      setState: vi.fn(async (patch: Record<string, unknown>) => {
        record.state = { ...(record.state as object), ...patch };
        record.version = 8;
      }),
    };
    const harness = {
      loadSession: vi.fn(async () => record),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await PATCH_HARNESS_STATE_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        requestBody: { view: 'done' },
        getHeader: (name: string) => (name === 'if-match' ? '"7"' : undefined),
      }),
    );

    expect(session.setState).toHaveBeenCalledWith({ view: 'done' }, { ifVersion: 7 });
    expect(response.headers.get('etag')).toBe('"8"');
    await expect(response.json()).resolves.toEqual({ view: 'done' });
  });

  it('patches state from the raw request body without dropping body keys that collide with handler context', async () => {
    const record = makeRecord({ state: { view: 'open' }, version: 7 });
    const session = {
      getRecord: () => record,
      setState: vi.fn(async (patch: Record<string, unknown>) => {
        record.state = { ...(record.state as object), ...patch };
        record.version = 8;
      }),
    };
    const harness = {
      loadSession: vi.fn(async ({ sessionId }: { sessionId: string }) => {
        expect(sessionId).toBe('session-1');
        return record;
      }),
      session: vi.fn(async ({ sessionId }: { sessionId: string }) => {
        expect(sessionId).toBe('session-1');
        return session;
      }),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await PATCH_HARNESS_STATE_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        requestBody: {
          name: 'state-owned-name',
          sessionId: 'state-owned-session',
          tools: ['state-owned-tools'],
          view: 'done',
        },
        requestPathParams: {
          name: 'code',
          sessionId: 'session-1',
        },
        getHeader: (name: string) => (name === 'if-match' ? '"7"' : undefined),
      }),
    );

    expect(session.setState).toHaveBeenCalledWith(
      {
        name: 'state-owned-name',
        sessionId: 'state-owned-session',
        tools: ['state-owned-tools'],
        view: 'done',
      },
      { ifVersion: 7 },
    );
    expect(response.headers.get('etag')).toBe('"8"');
  });

  it('rejects stale state patches before resolving a live session', async () => {
    const record = makeRecord({ version: 8 });
    const harness = {
      loadSession: vi.fn(async () => record),
      session: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      PATCH_HARNESS_STATE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: { view: 'done' },
          getHeader: (name: string) => (name === 'if-match' ? '"7"' : undefined),
        }),
      ),
      409,
      'harness.state_conflict',
    );
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('switches mode and model through the tenant-scoped live session', async () => {
    const record = makeRecord();
    const session = {
      getRecord: () => record,
      switchMode: vi.fn(async ({ mode }: { mode: string }) => {
        record.modeId = mode;
      }),
      models: {
        switch: vi.fn(async ({ model }: { model: string }) => {
          record.modelId = model;
        }),
      },
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      PATCH_HARNESS_MODE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
          requestBody: { mode: 'build' },
        }),
      ),
    ).resolves.toEqual({ modeId: 'build' });
    await expect(
      PATCH_HARNESS_MODEL_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
          requestBody: { model: 'gpt-x' },
        }),
      ),
    ).resolves.toEqual({ modelId: 'gpt-x' });
    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
  });

  it('applies permission mutations and returns a copied snapshot', async () => {
    const grants = { categories: ['read'], tools: [] };
    const rules = { categories: {}, tools: { shell: 'ask' as const } };
    const session = {
      permissions: {
        grantCategory: vi.fn(async ({ category }: { category: string }) => {
          grants.categories.push(category);
        }),
        grantTool: vi.fn(),
        revokeCategory: vi.fn(),
        revokeTool: vi.fn(),
        setPolicy: vi.fn(),
        getGrants: vi.fn(() => grants),
        getRules: vi.fn(() => rules),
      },
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await PATCH_HARNESS_PERMISSIONS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
        requestBody: { action: 'grantCategory', category: 'write' },
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
    expect(session.permissions.grantCategory).toHaveBeenCalledWith({ category: 'write' });
    expect(result).toEqual({
      grants: { categories: ['read', 'write'], tools: [] },
      rules: { categories: {}, tools: { shell: 'ask' } },
    });
  });

  it('rejects permission mutations with invalid direct handler bodies', async () => {
    const session = {
      permissions: {
        grantCategory: vi.fn(),
        grantTool: vi.fn(),
        revokeCategory: vi.fn(),
        revokeTool: vi.fn(),
        setPolicy: vi.fn(),
        getGrants: vi.fn(() => ({ categories: [], tools: [] })),
        getRules: vi.fn(() => ({ categories: {}, tools: {} })),
      },
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      PATCH_HARNESS_PERMISSIONS_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: { action: 'grantCategory', category: '' },
        }),
      ),
      400,
      'harness.validation',
    );

    await expectHarnessHttpError(
      PATCH_HARNESS_PERMISSIONS_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: { action: 'setPolicy', category: 'write', toolName: 'shell', policy: 'allow' },
        }),
      ),
      400,
      'harness.validation',
    );

    await expectHarnessHttpError(
      PATCH_HARNESS_PERMISSIONS_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: { action: 'setPolicy', toolName: 'shell', policy: 'sometimes' },
        }),
      ),
      400,
      'harness.validation',
    );

    expect(session.permissions.grantCategory).not.toHaveBeenCalled();
    expect(session.permissions.setPolicy).not.toHaveBeenCalled();
  });

  it('responds to inbox questions with the route item id and response id', async () => {
    const response = {
      itemId: 'item-1',
      kind: 'question' as const,
      status: 'accepted' as const,
      responseId: 'response-1',
      duplicate: false,
    };
    const session = {
      respondToQuestion: vi.fn(async () => response),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      RESPOND_HARNESS_INBOX_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          itemId: 'query-item',
          requestPathParams: { name: 'code', sessionId: 'session-1', itemId: 'item-1' },
          requestBody: {
            kind: 'question',
            answer: 'yes',
            responseId: 'response-1',
          },
        }),
      ),
    ).resolves.toEqual(response);
    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
    expect(session.respondToQuestion).toHaveBeenCalledWith({
      itemId: 'item-1',
      responseId: 'response-1',
      answer: 'yes',
    });
  });

  it('rejects unsupported inbox response kinds from direct handler calls', async () => {
    const session = {
      respondToToolApproval: vi.fn(),
      respondToToolSuspension: vi.fn(),
      respondToQuestion: vi.fn(),
      respondToPlanApproval: vi.fn(),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      RESPOND_HARNESS_INBOX_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          itemId: 'item-1',
          requestBody: {
            kind: 'future-kind',
            responseId: 'response-1',
          },
        }),
      ),
      400,
      'harness.validation',
    );

    expect(session.respondToToolApproval).not.toHaveBeenCalled();
    expect(session.respondToToolSuspension).not.toHaveBeenCalled();
    expect(session.respondToQuestion).not.toHaveBeenCalled();
    expect(session.respondToPlanApproval).not.toHaveBeenCalled();
  });

  it('maps inbox response conflicts to the wire error code', async () => {
    const session = {
      respondToQuestion: vi.fn(async () => {
        throw new HarnessInboxResponseConflictError('session-1', 'item-1', 'response-1');
      }),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      RESPOND_HARNESS_INBOX_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          itemId: 'item-1',
          requestBody: {
            kind: 'question',
            answer: 'yes',
            responseId: 'response-1',
          },
        }),
      ),
      409,
      'harness.inbox_response_conflict',
    );
  });

  it('sets, reads, pauses, resumes, and clears session goals', async () => {
    let goal = {
      id: 'goal-1',
      objective: 'ship',
      status: 'active' as const,
      turnsUsed: 0,
      maxTurns: 3,
      judgeModelId: 'judge',
      createdAt: 100,
    };
    const session = {
      setGoal: vi.fn(async () => goal),
      getGoal: vi.fn(() => goal),
      pauseGoal: vi.fn(async () => {
        goal = { ...goal, status: 'paused' as const };
        return goal;
      }),
      resumeGoal: vi.fn(async () => {
        goal = { ...goal, status: 'active' as const };
        return goal;
      }),
      clearGoal: vi.fn(async () => {
        goal = undefined as any;
      }),
    };
    const harness = {
      session: vi.fn(async () => session),
      loadSession: vi.fn(async () => makeRecord({ goal })),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      PUT_HARNESS_GOAL_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
          requestBody: { objective: 'ship', maxTurns: 3 },
        }),
      ),
    ).resolves.toEqual({ goal });
    await expect(
      GET_HARNESS_GOAL_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
        }),
      ),
    ).resolves.toEqual({ goal });
    expect(harness.loadSession).toHaveBeenCalledWith({ sessionId: 'session-1', includeClosed: true });
    await expect(
      PAUSE_HARNESS_GOAL_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
        }),
      ),
    ).resolves.toMatchObject({ goal: { status: 'paused' } });
    await expect(
      RESUME_HARNESS_GOAL_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
        }),
      ),
    ).resolves.toMatchObject({ goal: { status: 'active' } });
    const response = await DELETE_HARNESS_GOAL_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
      }),
    );
    expect(response.status).toBe(204);
    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
    expect(session.clearGoal).toHaveBeenCalled();
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
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
      }),
    );

    expect(response.status).toBe(204);
    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.loadSession).toHaveBeenCalledWith({ sessionId: 'session-1', includeClosed: true });
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
