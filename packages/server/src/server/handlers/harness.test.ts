import { createServer } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { SessionDisplayState, SessionRecord } from '@mastra/core/harness/v1';
import {
  HarnessAttachmentInUseError,
  HarnessAttachmentUnavailableError,
  HarnessInboxResponseConflictError,
  HarnessRuntimeDependencyDriftError,
} from '@mastra/core/harness/v1';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  createHarnessSessionBodySchema,
  harnessChannelDiagnosticsQuerySchema,
  harnessChannelDiagnosticsResponseSchema,
} from '../schemas/harness';
import { HARNESS_ROUTES } from '../server-adapter/routes/harness';

import {
  CLOSE_HARNESS_SESSION_ROUTE,
  CREATE_HARNESS_SESSION_ROUTE,
  DELETE_HARNESS_ATTACHMENT_ROUTE,
  DELETE_HARNESS_GOAL_ROUTE,
  GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE,
  GET_HARNESS_GOAL_ROUTE,
  GET_HARNESS_MESSAGE_RESULT_ROUTE,
  GET_HARNESS_QUEUE_RESULT_ROUTE,
  GET_HARNESS_SESSION_ROUTE,
  GET_HARNESS_SESSION_EVENTS_ROUTE,
  GET_HARNESS_STATE_ROUTE,
  LIST_HARNESS_SESSIONS_ROUTE,
  PATCH_HARNESS_MODE_ROUTE,
  PATCH_HARNESS_MODEL_ROUTE,
  PATCH_HARNESS_PERMISSIONS_ROUTE,
  PATCH_HARNESS_STATE_ROUTE,
  PAUSE_HARNESS_GOAL_ROUTE,
  POST_HARNESS_ATTACHMENT_ROUTE,
  POST_HARNESS_MESSAGE_ROUTE,
  POST_HARNESS_QUEUE_ROUTE,
  POST_HARNESS_SIGNAL_ROUTE,
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

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'app.event',
    id: 'harness-v1:epoch-1:1',
    timestamp: 1000,
    sessionId: 'session-1',
    payload: { ok: true },
    ...overrides,
  } as any;
}

async function readStreamChunk(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const result = await reader.read();
  await reader.cancel();
  return new TextDecoder().decode(result.value);
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
    return body;
  }
}

async function withUrlServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

describe('Harness server routes', () => {
  it('registers Harness routes as authenticated Harness client routes', () => {
    expect(HARNESS_ROUTES).toContain(LIST_HARNESS_SESSIONS_ROUTE);
    expect(HARNESS_ROUTES).toContain(CREATE_HARNESS_SESSION_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_SESSION_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE);
    expect(HARNESS_ROUTES).toContain(POST_HARNESS_ATTACHMENT_ROUTE);
    expect(HARNESS_ROUTES).toContain(DELETE_HARNESS_ATTACHMENT_ROUTE);
    expect(HARNESS_ROUTES).toContain(POST_HARNESS_MESSAGE_ROUTE);
    expect(HARNESS_ROUTES).toContain(POST_HARNESS_QUEUE_ROUTE);
    expect(HARNESS_ROUTES).toContain(POST_HARNESS_SIGNAL_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_MESSAGE_RESULT_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_QUEUE_RESULT_ROUTE);
    expect(HARNESS_ROUTES).toContain(GET_HARNESS_SESSION_EVENTS_ROUTE);
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
    expect(GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE.requiresAuth).toBe(true);
    expect(GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(POST_HARNESS_ATTACHMENT_ROUTE.requiresAuth).toBe(true);
    expect(POST_HARNESS_ATTACHMENT_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(DELETE_HARNESS_ATTACHMENT_ROUTE.requiresAuth).toBe(true);
    expect(DELETE_HARNESS_ATTACHMENT_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(POST_HARNESS_MESSAGE_ROUTE.requiresAuth).toBe(true);
    expect(POST_HARNESS_MESSAGE_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(POST_HARNESS_QUEUE_ROUTE.requiresAuth).toBe(true);
    expect(POST_HARNESS_QUEUE_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(POST_HARNESS_SIGNAL_ROUTE.requiresAuth).toBe(true);
    expect(POST_HARNESS_SIGNAL_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(GET_HARNESS_MESSAGE_RESULT_ROUTE.requiresAuth).toBe(true);
    expect(GET_HARNESS_MESSAGE_RESULT_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(GET_HARNESS_QUEUE_RESULT_ROUTE.requiresAuth).toBe(true);
    expect(GET_HARNESS_QUEUE_RESULT_ROUTE.harnessAuth).toEqual({ clientRoute: true });
    expect(GET_HARNESS_SESSION_EVENTS_ROUTE.requiresAuth).toBe(true);
    expect(GET_HARNESS_SESSION_EVENTS_ROUTE.harnessAuth).toEqual({
      clientRoute: true,
      allowSseSubscriptionToken: true,
    });
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

  it('returns read-only channel diagnostics for the authenticated resource', async () => {
    const diagnostics = {
      harnessName: 'code',
      resourceId: 'resource-1',
      sessionId: 'session-1',
      visibleSessionIds: ['session-1'],
      bindings: [
        {
          harnessName: 'code',
          channelId: 'support',
          bindingId: 'binding-1',
          providerId: 'slack',
          platform: 'slack',
          callbackTarget: 'support',
          durableId: 'code:support:binding-1',
        },
      ],
      inbox: [
        {
          id: 'inbox-1',
          status: 'failed',
          channelId: 'support',
          providerId: 'slack',
          admissionId: 'admission-1',
          externalMessageId: 'message-1',
          receivedAt: 1000,
          updatedAt: 1100,
          lease: { attempts: 2, nextAttemptAt: 2000 },
          lastError: { code: 'worker_unavailable', retryable: true },
        },
      ],
      actionTokens: [],
      actionReceipts: [],
      outbox: [],
      limit: 10,
      truncated: false,
      redacted: true,
    };
    const harness = {
      getChannelDiagnostics: vi.fn(async () => diagnostics),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        limit: 10,
        requestPathParams: { name: 'code', sessionId: 'session-1' },
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.getChannelDiagnostics).toHaveBeenCalledWith({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      limit: 10,
    });
    expect(result).toEqual(diagnostics);
  });

  it('does not accept caller-declared resource ids for channel diagnostics', async () => {
    expect(harnessChannelDiagnosticsQuerySchema.safeParse({ resourceId: 'attacker' }).success).toBe(false);
    expect(harnessChannelDiagnosticsQuerySchema.safeParse({ limit: 51 }).success).toBe(false);

    const harness = {
      getChannelDiagnostics: vi.fn(async () => ({
        harnessName: 'code',
        resourceId: 'resource-1',
        sessionId: 'session-1',
        visibleSessionIds: ['session-1'],
        bindings: [],
        inbox: [],
        actionTokens: [],
        actionReceipts: [],
        outbox: [],
        limit: 50,
        truncated: false,
        redacted: true,
      })),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        resourceId: 'attacker',
      }),
    );

    expect(harness.getChannelDiagnostics).toHaveBeenCalledWith({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      limit: undefined,
    });
  });

  it('rejects sensitive channel diagnostic fields in the response contract', async () => {
    const result = harnessChannelDiagnosticsResponseSchema.safeParse({
      harnessName: 'code',
      resourceId: 'resource-1',
      sessionId: 'session-1',
      visibleSessionIds: ['session-1'],
      bindings: [],
      inbox: [
        {
          id: 'inbox-1',
          status: 'received',
          channelId: 'support',
          providerId: 'slack',
          admissionId: 'admission-1',
          externalMessageId: 'message-1',
          receivedAt: 1000,
          updatedAt: 1000,
          lease: { attempts: 0 },
          content: 'raw provider message',
          requestContext: { platformUserId: 'user-secret' },
          claimId: 'claim-secret',
        },
      ],
      actionTokens: [
        {
          actionTokenId: 'action-token-1',
          status: 'active',
          channelId: 'support',
          providerId: 'slack',
          bindingId: 'binding-1',
          bindingGeneration: 1,
          resourceId: 'resource-1',
          owningSessionId: 'session-1',
          itemId: 'question-1',
          kind: 'question',
          runId: 'run-1',
          pendingRequestedAt: 1000,
          createdAt: 1000,
          updatedAt: 1000,
          transportHash: 'token-secret',
        },
      ],
      actionReceipts: [],
      outbox: [],
      limit: 10,
      truncated: false,
      redacted: true,
    });

    expect(result.success).toBe(false);
  });

  it('returns tenant-safe not found for hidden channel diagnostics sessions', async () => {
    const harness = {
      getChannelDiagnostics: vi.fn(async () => null),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestContext: makeRequestContext('resource-2'),
        }),
      ),
      404,
      'harness.session_not_found',
    );
  });

  it('maps unsupported channel diagnostics storage to 501', async () => {
    const unsupported = Object.assign(new Error('Harness channel diagnostics are unavailable'), {
      name: 'HarnessStorageChannelDiagnosticsUnsupportedError',
    });
    const harness = {
      getChannelDiagnostics: vi.fn(async () => {
        throw unsupported;
      }),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      GET_HARNESS_CHANNEL_DIAGNOSTICS_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
        }),
      ),
      501,
      'harness.channel_diagnostics_unsupported',
    );
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

  it('uploads file, primitive, and element attachments through the authenticated session scope', async () => {
    const uploadedRef = {
      attachmentId: 'attachment-1',
      resourceId: 'resource-1',
      ownerSessionId: 'session-1',
      bytes: 5,
      sha256: 'sha',
      source: 'preupload',
      kind: 'file',
      name: 'note.txt',
      mimeType: 'text/plain',
    };
    const harness = {
      attachments: {
        upload: vi.fn(async () => uploadedRef),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      POST_HARNESS_ATTACHMENT_ROUTE.handler(
        makeParams({
          mastra,
          name: 'query-code',
          sessionId: 'query-session',
          requestPathParams: { name: 'code', sessionId: 'session-1' },
          requestBody: {
            file: Buffer.from('hello'),
            filename: 'note.txt',
            contentType: 'text/plain',
            metadata: { source: 'test' },
          },
        }),
      ),
    ).resolves.toEqual(uploadedRef);
    await POST_HARNESS_ATTACHMENT_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        requestBody: {
          kind: 'primitive',
          name: 'selection',
          primitiveType: 'selection',
          value: { text: 'quoted' },
          metadata: { provider: 'r2-compatible' },
        },
      }),
    );
    await POST_HARNESS_ATTACHMENT_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        requestBody: {
          kind: 'element',
          name: 'chart',
          elementType: 'chart',
          payload: { series: [1, 2] },
          renderer: { component: 'chart' },
          schemaId: 'chart.v1',
          metadata: { bucket: 'cloudflare-r2' },
        },
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.attachments.upload).toHaveBeenNthCalledWith(1, {
      sessionId: 'session-1',
      resourceId: 'resource-1',
      kind: 'file',
      data: new Uint8Array(Buffer.from('hello')),
      filename: 'note.txt',
      contentType: 'text/plain',
      metadata: { source: 'test' },
    });
    expect(harness.attachments.upload).toHaveBeenNthCalledWith(2, {
      sessionId: 'session-1',
      resourceId: 'resource-1',
      kind: 'primitive',
      name: 'selection',
      primitiveType: 'selection',
      value: { text: 'quoted' },
      metadata: { provider: 'r2-compatible' },
    });
    expect(harness.attachments.upload).toHaveBeenNthCalledWith(3, {
      sessionId: 'session-1',
      resourceId: 'resource-1',
      kind: 'element',
      name: 'chart',
      elementType: 'chart',
      payload: { series: [1, 2] },
      renderer: { component: 'chart' },
      schemaId: 'chart.v1',
      metadata: { bucket: 'cloudflare-r2' },
    });
  });

  it('enforces Harness inline attachment byte policy before upload', async () => {
    const harness = {
      getFileConfig: vi.fn(() => ({ maxInlineBytes: 4 })),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_ATTACHMENT_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            file: Buffer.from('hello'),
            filename: 'note.txt',
            contentType: 'text/plain',
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );

    expect(harness.getFileConfig).toHaveBeenCalled();
    expect(harness.attachments.upload).not.toHaveBeenCalled();
  });

  it('enforces Harness inline attachment byte policy for primitives and elements before upload', async () => {
    const harness = {
      getFileConfig: vi.fn(() => ({ maxInlineBytes: 4 })),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_ATTACHMENT_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            kind: 'primitive',
            name: 'selection',
            primitiveType: 'selection',
            value: { text: 'quoted' },
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );
    await expectHarnessHttpError(
      POST_HARNESS_ATTACHMENT_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            kind: 'element',
            name: 'chart',
            elementType: 'chart',
            payload: { series: [1, 2] },
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );

    expect(harness.getFileConfig).toHaveBeenCalledTimes(2);
    expect(harness.attachments.upload).not.toHaveBeenCalled();
  });

  it('deletes unused attachments through guarded Harness attachment delete', async () => {
    const harness = {
      attachments: {
        delete: vi.fn(async () => undefined),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await DELETE_HARNESS_ATTACHMENT_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        attachmentId: 'query-attachment',
        requestPathParams: { name: 'code', sessionId: 'session-1', attachmentId: 'attachment-1' },
      }),
    );

    expect(response.status).toBe(204);
    expect(harness.attachments.delete).toHaveBeenCalledWith({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      attachmentId: 'attachment-1',
    });
  });

  it('maps guarded attachment delete conflicts to 409', async () => {
    const harness = {
      attachments: {
        delete: vi.fn(async () => {
          throw new HarnessAttachmentInUseError('session-1', 'attachment-1', [
            { source: 'message', sourceId: 'signal-1' },
          ]);
        }),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      DELETE_HARNESS_ATTACHMENT_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          attachmentId: 'attachment-1',
        }),
      ),
      409,
      'harness.attachment_in_use',
    );
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

  it('ingests URL message files into Harness-owned refs before admission', async () => {
    let requestHeaders: IncomingHttpHeaders | undefined;
    const uploadedRef = {
      attachmentId: 'attachment-url-1',
      resourceId: 'resource-1',
      ownerSessionId: 'session-1',
      bytes: 9,
      sha256: 'stored-sha',
      source: 'url',
      kind: 'file',
      name: 'remote.txt',
      mimeType: 'text/plain',
    };
    const session = {
      admitMessage: vi.fn(async () => ({
        accepted: true as const,
        signalId: 'signal-1',
        duplicate: false,
      })),
    };
    const harness = {
      getFileConfig: vi.fn(() => ({ allowPrivateNetworkUrls: true })),
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(async () => uploadedRef),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await withUrlServer(
      (request, response) => {
        requestHeaders = request.headers;
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('url-bytes');
      },
      async baseUrl => {
        await expect(
          POST_HARNESS_MESSAGE_ROUTE.handler(
            makeParams({
              mastra,
              name: 'code',
              sessionId: 'session-1',
              requestBody: {
                content: 'hello',
                admissionId: 'admission-1',
                files: [
                  {
                    kind: 'url',
                    url: `${baseUrl}/remote.txt`,
                    name: 'remote.txt',
                    mimeType: 'text/plain',
                    metadata: { provider: 'cloudflare-r2-compatible' },
                  },
                ],
              },
            }),
          ),
        ).resolves.toEqual({ accepted: true, signalId: 'signal-1', duplicate: false });
      },
    );

    expect(requestHeaders?.accept).toBe('text/plain');
    expect(requestHeaders?.authorization).toBeUndefined();
    expect(requestHeaders?.cookie).toBeUndefined();
    expect(harness.getFileConfig).toHaveBeenCalled();
    expect(harness.attachments.upload).toHaveBeenCalledTimes(1);
    const uploaded = harness.attachments.upload.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(uploaded).toMatchObject({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      kind: 'file',
      data: new Uint8Array(Buffer.from('url-bytes')),
      filename: 'remote.txt',
      contentType: 'text/plain',
      source: 'url',
      metadata: { provider: 'cloudflare-r2-compatible' },
    });
    expect(uploaded.attachmentId).toMatch(/^attachment-url-/);
    expect(session.admitMessage).toHaveBeenCalledWith({
      content: 'hello',
      admissionId: 'admission-1',
      attachments: [uploadedRef],
    });
  });

  it('uses stable URL attachment ids for admission retries', async () => {
    const session = {
      admitMessage: vi.fn(async () => ({
        accepted: true as const,
        signalId: 'signal-1',
        duplicate: false,
      })),
    };
    const harness = {
      getFileConfig: vi.fn(() => ({ allowPrivateNetworkUrls: true })),
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(async (opts: any) => ({
          attachmentId: opts.attachmentId,
          resourceId: 'resource-1',
          ownerSessionId: 'session-1',
          bytes: 9,
          sha256: 'stored-sha',
          source: 'url',
          kind: 'file',
          name: opts.filename,
          mimeType: opts.contentType,
        })),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await withUrlServer(
      (_request, response) => {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('url-bytes');
      },
      async baseUrl => {
        const requestBody = {
          content: 'hello',
          admissionId: 'admission-1',
          files: [{ kind: 'url', url: `${baseUrl}/remote.txt`, name: 'remote.txt', mimeType: 'text/plain' }],
        };
        await POST_HARNESS_MESSAGE_ROUTE.handler(
          makeParams({ mastra, name: 'code', sessionId: 'session-1', requestBody }),
        );
        await POST_HARNESS_MESSAGE_ROUTE.handler(
          makeParams({ mastra, name: 'code', sessionId: 'session-1', requestBody }),
        );
      },
    );

    const firstId = harness.attachments.upload.mock.calls[0]?.[0].attachmentId;
    const secondId = harness.attachments.upload.mock.calls[1]?.[0].attachmentId;
    expect(firstId).toMatch(/^attachment-url-/);
    expect(secondId).toBe(firstId);
  });

  it('does not buffer redirect bodies before following URL attachment redirects', async () => {
    const session = {
      admitMessage: vi.fn(async () => ({
        accepted: true as const,
        signalId: 'signal-1',
        duplicate: false,
      })),
    };
    const harness = {
      getFileConfig: vi.fn(() => ({ allowPrivateNetworkUrls: true, maxUrlBytes: 4 })),
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(async (opts: any) => ({
          attachmentId: opts.attachmentId,
          resourceId: 'resource-1',
          ownerSessionId: 'session-1',
          bytes: opts.data.byteLength,
          sha256: 'stored-sha',
          source: 'url',
          kind: 'file',
          name: opts.filename,
          mimeType: opts.contentType,
        })),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await withUrlServer(
      (request, response) => {
        if (request.url === '/redirect') {
          response.writeHead(302, { location: '/remote.txt', 'content-type': 'text/plain' });
          response.end('too-large-for-policy');
          return;
        }
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('ok');
      },
      async baseUrl => {
        await expect(
          POST_HARNESS_MESSAGE_ROUTE.handler(
            makeParams({
              mastra,
              name: 'code',
              sessionId: 'session-1',
              requestBody: {
                content: 'hello',
                admissionId: 'admission-1',
                files: [{ kind: 'url', url: `${baseUrl}/redirect`, name: 'remote.txt', mimeType: 'text/plain' }],
              },
            }),
          ),
        ).resolves.toEqual({ accepted: true, signalId: 'signal-1', duplicate: false });
      },
    );

    expect(harness.attachments.upload).toHaveBeenCalledTimes(1);
    expect(harness.attachments.upload.mock.calls[0]?.[0].data).toEqual(new Uint8Array(Buffer.from('ok')));
  });

  it('normalizes spec ref attachments before message admission', async () => {
    const session = {
      admitMessage: vi.fn(async () => ({
        accepted: true as const,
        signalId: 'signal-1',
        duplicate: false,
      })),
    };
    const harness = {
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      POST_HARNESS_MESSAGE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            content: 'hello',
            admissionId: 'admission-1',
            files: [
              {
                kind: 'ref',
                attachmentKind: 'element',
                attachmentId: 'attachment-1',
                resourceId: 'resource-1',
                ownerSessionId: 'session-1',
                bytes: 128,
                sha256: 'sha',
                source: 'preupload',
                name: 'chart',
                elementType: 'chart',
              },
            ],
          },
        }),
      ),
    ).resolves.toEqual({ accepted: true, signalId: 'signal-1', duplicate: false });

    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitMessage).toHaveBeenCalledWith({
      content: 'hello',
      admissionId: 'admission-1',
      attachments: [
        {
          kind: 'element',
          attachmentId: 'attachment-1',
          resourceId: 'resource-1',
          ownerSessionId: 'session-1',
          bytes: 128,
          sha256: 'sha',
          source: 'preupload',
          name: 'chart',
          elementType: 'chart',
        },
      ],
    });
  });

  it('rejects direct handler calls that provide both files and attachments', async () => {
    const session = {
      admitMessage: vi.fn(),
    };
    const harness = {
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_MESSAGE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            content: 'hello',
            admissionId: 'admission-1',
            files: [{ attachmentId: 'attachment-1', resourceId: 'resource-1' }],
            attachments: [{ attachmentId: 'attachment-2', resourceId: 'resource-1' }],
          },
        }),
      ),
      400,
      'harness.validation',
    );

    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitMessage).not.toHaveBeenCalled();
  });

  it('rejects unsupported URL attachments before upload or durable admission', async () => {
    const session = {
      admitMessage: vi.fn(),
    };
    const harness = {
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_MESSAGE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            content: 'hello',
            admissionId: 'admission-1',
            attachments: [{ kind: 'url', url: 'file:///tmp/secret', name: 'secret.txt' }],
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );
    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitMessage).not.toHaveBeenCalled();
  });

  it('blocks private IPv6 URL attachment targets before upload or admission', async () => {
    const session = {
      admitMessage: vi.fn(),
    };
    const harness = {
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_MESSAGE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            content: 'hello',
            admissionId: 'admission-1',
            files: [{ kind: 'url', url: 'http://[fe90::1]/secret.txt', name: 'secret.txt' }],
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );

    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitMessage).not.toHaveBeenCalled();
  });

  it('fails closed when URL attachment host resolution fails', async () => {
    const session = {
      admitMessage: vi.fn(),
    };
    const harness = {
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      POST_HARNESS_MESSAGE_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          requestBody: {
            content: 'hello',
            admissionId: 'admission-1',
            files: [{ kind: 'url', url: 'http://host-does-not-exist.invalid/secret.txt', name: 'secret.txt' }],
          },
        }),
      ),
      400,
      'harness.attachment_unavailable',
    );

    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitMessage).not.toHaveBeenCalled();
  });

  it('enforces Harness URL attachment byte policy before upload or admission', async () => {
    const session = {
      admitMessage: vi.fn(),
    };
    const harness = {
      getFileConfig: vi.fn(() => ({ allowPrivateNetworkUrls: true, maxUrlBytes: 4 })),
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await withUrlServer(
      (_request, response) => {
        response.writeHead(200, { 'content-length': '9', 'content-type': 'text/plain' });
        response.end('url-bytes');
      },
      async baseUrl => {
        await expectHarnessHttpError(
          POST_HARNESS_MESSAGE_ROUTE.handler(
            makeParams({
              mastra,
              name: 'code',
              sessionId: 'session-1',
              requestBody: {
                content: 'hello',
                admissionId: 'admission-1',
                files: [{ kind: 'url', url: `${baseUrl}/remote.txt`, name: 'remote.txt' }],
              },
            }),
          ),
          400,
          'harness.attachment_unavailable',
        );
      },
    );

    expect(harness.getFileConfig).toHaveBeenCalled();
    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitMessage).not.toHaveBeenCalled();
  });

  it('rejects URL digest mismatches before upload or queue admission', async () => {
    const session = {
      admitQueue: vi.fn(),
    };
    const harness = {
      getFileConfig: vi.fn(() => ({ allowPrivateNetworkUrls: true })),
      session: vi.fn(async () => session),
      attachments: {
        upload: vi.fn(),
      },
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await withUrlServer(
      (_request, response) => {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('url-bytes');
      },
      async baseUrl => {
        await expectHarnessHttpError(
          POST_HARNESS_QUEUE_ROUTE.handler(
            makeParams({
              mastra,
              name: 'code',
              sessionId: 'session-1',
              requestBody: {
                content: 'next',
                admissionId: 'admission-queue-1',
                attachments: [
                  {
                    kind: 'url',
                    url: `${baseUrl}/remote.txt`,
                    name: 'remote.txt',
                    mimeType: 'text/plain',
                    sha256: 'not-the-digest',
                  },
                ],
              },
            }),
          ),
          400,
          'harness.attachment_unavailable',
        );
      },
    );

    expect(harness.attachments.upload).not.toHaveBeenCalled();
    expect(session.admitQueue).not.toHaveBeenCalled();
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

  it('dispatches a live user-message signal without serializing its completion promise', async () => {
    const completion = Promise.resolve({ text: 'done' });
    const session = {
      signal: vi.fn(async () => ({
        accepted: true as const,
        id: 'signal-1',
        runId: 'run-1',
        willInterleave: true,
        signal: { id: 'signal-1', type: 'user-message' },
        result: completion,
      })),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await POST_HARNESS_SIGNAL_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        requestPathParams: { name: 'code', sessionId: 'session-1' },
        requestBody: {
          type: 'user-message',
          content: [{ type: 'text', text: 'follow up' }],
          signalId: 'client-signal-1',
          ifActive: { attributes: { delivery: 'while-active' } },
          ifIdle: { attributes: { delivery: 'message' } },
        },
      }),
    );

    expect(mastra.getHarness).toHaveBeenCalledWith('code');
    expect(harness.session).toHaveBeenCalledWith({ sessionId: 'session-1', resourceId: 'resource-1' });
    expect(session.signal).toHaveBeenCalledWith({
      content: [{ type: 'text', text: 'follow up' }],
      signalId: 'client-signal-1',
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    });
    expect(result).toEqual({
      accepted: true,
      id: 'signal-1',
      runId: 'run-1',
      willInterleave: true,
      signal: { id: 'signal-1', type: 'user-message' },
    });
  });

  it('dispatches a live system-reminder signal through the Harness session', async () => {
    const session = {
      injectSystemReminder: vi.fn(async () => ({
        accepted: true as const,
        id: 'signal-reminder-1',
        runId: 'run-1',
        willInterleave: false,
        signal: { id: 'signal-reminder-1', type: 'system-reminder' },
      })),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await POST_HARNESS_SIGNAL_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        requestBody: {
          type: 'system-reminder',
          contents: 'continue',
          attributes: { type: 'goal-judge' },
          metadata: { goalId: 'goal-1' },
        },
      }),
    );

    expect(session.injectSystemReminder).toHaveBeenCalledWith('continue', {
      attributes: { type: 'goal-judge' },
      metadata: { goalId: 'goal-1' },
    });
    expect(result).toEqual({
      accepted: true,
      id: 'signal-reminder-1',
      runId: 'run-1',
      willInterleave: false,
      signal: { id: 'signal-reminder-1', type: 'system-reminder' },
    });
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

  it('looks up message operation results without re-admitting work', async () => {
    const harness = {
      lookupMessageResult: vi.fn(async () => ({
        status: 'completed',
        runId: 'run-1',
        result: { text: 'done' },
      })),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const result = await GET_HARNESS_MESSAGE_RESULT_ROUTE.handler(
      makeParams({
        mastra,
        name: 'query-code',
        sessionId: 'query-session',
        signalId: 'query-signal',
        requestPathParams: { name: 'code', sessionId: 'session-1', signalId: 'signal-1' },
      }),
    );

    expect(harness.lookupMessageResult).toHaveBeenCalledWith({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      signalId: 'signal-1',
    });
    expect(result).toEqual({
      status: 'completed',
      source: 'message',
      runId: 'run-1',
      result: { text: 'done' },
    });
  });

  it('maps missing and failed message operation evidence', async () => {
    const harness = {
      lookupMessageResult: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          status: 'failed',
          runId: 'run-2',
          error: { code: 'agent.failed', message: 'agent failed' },
        }),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      GET_HARNESS_MESSAGE_RESULT_ROUTE.handler(
        makeParams({ mastra, name: 'code', sessionId: 'session-1', signalId: 'missing' }),
      ),
    ).resolves.toEqual({ status: 'not_found', source: 'message' });
    await expect(
      GET_HARNESS_MESSAGE_RESULT_ROUTE.handler(
        makeParams({ mastra, name: 'code', sessionId: 'session-1', signalId: 'failed' }),
      ),
    ).resolves.toEqual({
      status: 'failed',
      source: 'message',
      runId: 'run-2',
      error: { code: 'agent.failed', message: 'agent failed' },
    });
  });

  it('looks up queued work summaries including pending and expired states', async () => {
    const harness = {
      lookupQueueResult: vi
        .fn()
        .mockResolvedValueOnce({ status: 'queued', queuedItemId: 'queue-1', runId: 'run-queue' })
        .mockResolvedValueOnce({ kind: 'queue', queuedItemId: 'queue-1', expiresAt: 2000 }),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expect(
      GET_HARNESS_QUEUE_RESULT_ROUTE.handler(
        makeParams({ mastra, name: 'code', sessionId: 'session-1', queuedItemId: 'queue-1' }),
      ),
    ).resolves.toEqual({ status: 'pending', source: 'queue', runId: 'run-queue' });
    await expect(
      GET_HARNESS_QUEUE_RESULT_ROUTE.handler(
        makeParams({ mastra, name: 'code', sessionId: 'session-1', queuedItemId: 'queue-1' }),
      ),
    ).resolves.toEqual({ status: 'expired', source: 'queue', expiredAt: 2000 });
  });

  it('streams live Harness session events and cleans up on disconnect', async () => {
    let listener: ((event: any) => void) | undefined;
    const unsubscribe = vi.fn();
    const session = {
      subscribe: vi.fn((next: (event: any) => void) => {
        listener = next;
        return unsubscribe;
      }),
      getEventReplayState: vi.fn(),
      listEventsAfter: vi.fn(),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    listener?.(makeEvent());
    const chunk = await reader.read();
    await reader.cancel();
    const text = new TextDecoder().decode(chunk.value);
    expect(text).toContain('id: harness-v1:epoch-1:1');
    expect(text).toContain('event: app.event');
    expect(text).toContain('"payload":{"ok":true}');
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('serializes live Harness SSE events with the replay-safe JSON projection', async () => {
    class Box {
      constructor(readonly value: string) {}
    }
    let listener: ((event: any) => void) | undefined;
    const session = {
      subscribe: vi.fn((next: (event: any) => void) => {
        listener = next;
        return vi.fn();
      }),
      getEventReplayState: vi.fn(),
      listEventsAfter: vi.fn(),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({ mastra, name: 'code', sessionId: 'session-1' }),
    );

    const reader = response.body!.getReader();
    listener?.(
      makeEvent({
        type: 'tool_end',
        toolCallId: 'tc1',
        isError: true,
        result: {
          error: new Error('lookup failed'),
          at: new Date('2026-05-19T00:00:00.000Z'),
          boxed: new Box('ok'),
          omitted: undefined,
        },
      }),
    );
    const chunk = await reader.read();
    await reader.cancel();
    const text = new TextDecoder().decode(chunk.value);
    const data = JSON.parse(
      text
        .split('\n')
        .find(line => line.startsWith('data: '))!
        .slice('data: '.length),
    );
    expect(text).toContain('event: tool_end');
    expect(data.result).toEqual({
      error: { name: 'Error', code: 'Error', message: 'lookup failed' },
      at: '2026-05-19T00:00:00.000Z',
      boxed: { value: 'ok' },
    });
  });

  it('replays missed events from Last-Event-ID without duplicating queued live events', async () => {
    let listener: ((event: any) => void) | undefined;
    const session = {
      subscribe: vi.fn((next: (event: any) => void) => {
        listener = next;
        return vi.fn();
      }),
      getEventReplayState: vi.fn(async () => ({
        epoch: 'epoch-1',
        oldestSequence: 1,
        newestSequence: 2,
      })),
      listEventsAfter: vi.fn(async () => [
        { sequence: 2, event: makeEvent({ id: 'harness-v1:epoch-1:2', payload: { replay: true } }) },
      ]),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        getHeader: (header: string) => (header === 'last-event-id' ? 'harness-v1:epoch-1:1' : undefined),
      }),
    );
    listener?.(makeEvent({ id: 'harness-v1:epoch-1:2', payload: { replay: true } }));
    const text = await readStreamChunk(response);

    expect(session.getEventReplayState).toHaveBeenCalled();
    expect(session.listEventsAfter).toHaveBeenCalledWith({ epoch: 'epoch-1', afterSequence: 1, limit: 1000 });
    expect(text).toContain('id: harness-v1:epoch-1:2');
    expect(text).toContain('"replay":true');
    expect(text.match(/id: harness-v1:epoch-1:2/g)).toHaveLength(1);
  });

  it('replays closed-session Harness SSE events without reopening the session', async () => {
    const replayed = makeEvent({ id: 'harness-v1:epoch-1:2', payload: { replay: 'closed' } });
    const harness = {
      loadSession: vi.fn(async () => makeRecord({ closedAt: 300 })),
      session: vi.fn(),
      getSessionEventReplayState: vi.fn(async () => ({
        epoch: 'epoch-1',
        oldestSequence: 1,
        newestSequence: 2,
      })),
      listSessionEventsAfter: vi.fn(async () => [{ sequence: 2, event: replayed }]),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        getHeader: (header: string) => (header === 'last-event-id' ? 'harness-v1:epoch-1:1' : undefined),
      }),
    );
    const text = await readStreamChunk(response);

    expect(response.status).toBe(200);
    expect(harness.session).not.toHaveBeenCalled();
    expect(harness.getSessionEventReplayState).toHaveBeenCalledWith({
      sessionId: 'session-1',
      resourceId: 'resource-1',
    });
    expect(harness.listSessionEventsAfter).toHaveBeenCalledWith({
      sessionId: 'session-1',
      resourceId: 'resource-1',
      epoch: 'epoch-1',
      afterSequence: 1,
      limit: 1000,
    });
    expect(text).toContain('id: harness-v1:epoch-1:2');
    expect(text).toContain('"replay":"closed"');
  });

  it('still rejects closed-session Harness SSE streams when no replay cursor is supplied', async () => {
    const harness = {
      loadSession: vi.fn(async () => makeRecord({ closedAt: 300 })),
      session: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      GET_HARNESS_SESSION_EVENTS_ROUTE.handler(makeParams({ mastra, name: 'code', sessionId: 'session-1' })),
      404,
      'harness.session_closed',
    );
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('pages replay through contiguous durable backlogs larger than one fetch', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => {
      const sequence = index + 2;
      return { sequence, event: makeEvent({ id: `harness-v1:epoch-1:${sequence}` }) };
    });
    const secondPage = [{ sequence: 1002, event: makeEvent({ id: 'harness-v1:epoch-1:1002' }) }];
    const session = {
      subscribe: vi.fn(() => vi.fn()),
      getEventReplayState: vi.fn(async () => ({
        epoch: 'epoch-1',
        oldestSequence: 1,
        newestSequence: 1002,
      })),
      listEventsAfter: vi.fn(async ({ afterSequence }: { afterSequence: number }) =>
        afterSequence === 1 ? firstPage : secondPage,
      ),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        getHeader: (header: string) => (header === 'last-event-id' ? 'harness-v1:epoch-1:1' : undefined),
      }),
    );

    expect(response.status).toBe(200);
    expect(session.listEventsAfter).toHaveBeenCalledWith({ epoch: 'epoch-1', afterSequence: 1, limit: 1000 });
    expect(session.listEventsAfter).toHaveBeenCalledWith({ epoch: 'epoch-1', afterSequence: 1001, limit: 1000 });
  });

  it('rejects malformed Last-Event-ID values before opening the live stream', async () => {
    const session = {
      subscribe: vi.fn(),
      getEventReplayState: vi.fn(),
      listEventsAfter: vi.fn(),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
        makeParams({
          mastra,
          name: 'code',
          sessionId: 'session-1',
          getHeader: (header: string) => (header === 'last-event-id' ? 'bad-id' : undefined),
        }),
      ),
      400,
      'harness.validation',
    );
    expect(harness.session).not.toHaveBeenCalled();
  });

  it('returns a deterministic 412 for stale epochs and unreplayable gaps', async () => {
    const unsubscribe = vi.fn();
    const session = {
      subscribe: vi.fn(() => unsubscribe),
      getEventReplayState: vi.fn(async () => ({
        epoch: 'epoch-2',
        oldestSequence: 5,
        newestSequence: 8,
      })),
      listEventsAfter: vi.fn(),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        getHeader: (header: string) => (header === 'last-event-id' ? 'harness-v1:epoch-1:1' : undefined),
      }),
    );

    expect(response.status).toBe(412);
    await expect(response.json()).resolves.toMatchObject({
      code: 'harness.event_replay_unavailable',
      details: {
        reason: 'stale_epoch',
        recovery: {
          snapshot: 'GET /harness/:name/sessions/:sessionId',
        },
      },
    });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns 412 when replay rows do not cover a contiguous range through the newest durable event', async () => {
    const session = {
      subscribe: vi.fn(() => vi.fn()),
      getEventReplayState: vi.fn(async () => ({
        epoch: 'epoch-1',
        oldestSequence: 1,
        newestSequence: 4,
      })),
      listEventsAfter: vi.fn(async () => [
        { sequence: 2, event: makeEvent({ id: 'harness-v1:epoch-1:2' }) },
        { sequence: 4, event: makeEvent({ id: 'harness-v1:epoch-1:4' }) },
      ]),
    };
    const harness = {
      loadSession: vi.fn(async () => makeRecord()),
      session: vi.fn(async () => session),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    const response = await GET_HARNESS_SESSION_EVENTS_ROUTE.handler(
      makeParams({
        mastra,
        name: 'code',
        sessionId: 'session-1',
        getHeader: (header: string) => (header === 'last-event-id' ? 'harness-v1:epoch-1:1' : undefined),
      }),
    );

    expect(response.status).toBe(412);
    await expect(response.json()).resolves.toMatchObject({
      code: 'harness.event_replay_unavailable',
      details: { reason: 'unreplayable_gap' },
    });
  });

  it('denies event streams for sessions outside the authenticated resource', async () => {
    const harness = {
      loadSession: vi.fn(async () => makeRecord({ resourceId: 'other-resource' })),
      session: vi.fn(),
    };
    const mastra = { getHarness: vi.fn(() => harness) };

    await expectHarnessHttpError(
      GET_HARNESS_SESSION_EVENTS_ROUTE.handler(makeParams({ mastra, name: 'code', sessionId: 'session-1' })),
      404,
      'harness.session_not_found',
    );
    expect(harness.session).not.toHaveBeenCalled();
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

  it('maps runtime dependency drift to the wire error code', async () => {
    const session = {
      respondToQuestion: vi.fn(async () => {
        throw new HarnessRuntimeDependencyDriftError(
          'workspace_provider',
          'unconfigured',
          'was recorded, but the current workspace dependency is "workspace-now-configured"',
          'pending question resume',
        );
      }),
    };
    const harness = { session: vi.fn(async () => session) };
    const mastra = { getHarness: vi.fn(() => harness) };

    const body = await expectHarnessHttpError(
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
      'harness.runtime_dependency_drifted',
    );
    expect(body).toMatchObject({
      details: {
        dependencyKind: 'workspace_provider',
        dependencyId: 'unconfigured',
        reason: 'was recorded, but the current workspace dependency is "workspace-now-configured"',
        context: 'pending question resume',
      },
    });
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
