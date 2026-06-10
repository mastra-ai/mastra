import type { HarnessMode } from '@mastra/core/harness/v1';
import type { SessionRecord } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import {
  createHarnessSessionBodySchema,
  getHarnessResponseSchema,
  getHarnessSessionMessagesResponseSchema,
  getHarnessSessionResponseSchema,
  getHarnessSessionThreadResponseSchema,
  harnessIdPathParams,
  harnessSessionIdPathParams,
  listHarnessModesResponseSchema,
  listHarnessSessionsQuerySchema,
  listHarnessSessionsResponseSchema,
  listHarnessesResponseSchema,
  sendHarnessSessionMessageBodySchema,
  sendHarnessSessionMessageResponseSchema,
  switchHarnessSessionModeBodySchema,
  switchHarnessSessionModelBodySchema,
} from '../schemas/harnesses';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

type HarnessSession = {
  id: string;
  getState(): Readonly<Record<string, unknown>>;
  listPendingItems(): SessionRecord['pending'];
  isBusy(): boolean;
  getQueueDepth(): number;
  getCurrentRunId(): string | null;
  getCurrentTraceId(): string | null;
  getModelId(): string;
  getMode(): HarnessMode;
  setModelId(modelId: string): void;
  setMode(mode: HarnessMode): void;
  getThread(): Promise<unknown>;
  getMessages(): Promise<unknown[]>;
  subscribeToThread(): Promise<{
    stream: AsyncIterable<unknown>;
    abort(): boolean;
    unsubscribe(): void;
  }>;
  sendMessage(options: { messages: unknown; [key: string]: unknown }): Promise<unknown>;
  queueMessage(options: { messages: unknown; [key: string]: unknown }): Promise<unknown>;
};

type RegisteredHarness = {
  ownerId: string;
  listModes(): HarnessMode[];
  getMode(modeId: string): HarnessMode | undefined;
  listSessions(): Promise<SessionRecord[]>;
  getSessionRecord(opts: { sessionId: string; resourceId?: string }): Promise<SessionRecord>;
  session(
    opts:
      | { sessionId: string; resourceId?: string }
      | { resourceId: string; threadId: string; modeId?: string; modelId?: string },
  ): Promise<HarnessSession>;
};

type MastraWithHarnesses = {
  listHarnesses?: () => Record<string, RegisteredHarness> | undefined;
  getHarnessById?: (id: string) => RegisteredHarness;
};

function serializeMode(mode: HarnessMode) {
  const { id, defaultModelId, description, instructions, transitionsTo, metadata } = mode;
  return { id, defaultModelId, description, instructions, transitionsTo, metadata };
}

function getHarnessEntries(mastra: unknown): [string, RegisteredHarness][] {
  const registry = mastra as MastraWithHarnesses;
  return Object.entries(registry.listHarnesses?.() ?? {}) as [string, RegisteredHarness][];
}

function getHarnessByKeyOrId(mastra: unknown, harnessId: string): { id: string; harness: RegisteredHarness } {
  const registry = mastra as MastraWithHarnesses;
  const byKey = (registry.listHarnesses?.() ?? {}) as Record<string, RegisteredHarness>;
  const harness = byKey[harnessId];
  if (harness) {
    return { id: harnessId, harness };
  }

  const entry = getHarnessEntries(mastra).find(([, item]) => item.ownerId === harnessId);
  if (entry) {
    return { id: entry[0], harness: entry[1] };
  }

  const byId = registry.getHarnessById?.(harnessId);
  if (byId) {
    return { id: harnessId, harness: byId };
  }
  throw new HTTPException(404, { message: `Harness with id ${harnessId} not found` });
}

function serializeHarness(id: string, harness: RegisteredHarness) {
  return {
    id,
    ownerId: harness.ownerId,
    modes: harness.listModes().map(serializeMode),
  };
}

function isSessionLookupError(error: unknown): error is Error {
  return (
    error instanceof Error && error.message.startsWith('Harness session "') && error.message.includes('" was not found')
  );
}

async function getSessionRecordOrThrow(
  harness: RegisteredHarness,
  sessionId: string,
  resourceId?: string,
): Promise<SessionRecord> {
  try {
    return await harness.getSessionRecord({ sessionId, resourceId });
  } catch (error) {
    if (isSessionLookupError(error)) {
      throw new HTTPException(404, { message: error.message });
    }
    throw error;
  }
}

async function getSessionOrThrow(
  harness: RegisteredHarness,
  sessionId: string,
  resourceId?: string,
): Promise<HarnessSession> {
  try {
    return await harness.session({ sessionId, resourceId });
  } catch (error) {
    if (isSessionLookupError(error)) {
      throw new HTTPException(404, { message: error.message });
    }
    throw error;
  }
}

function serializeSession(record: SessionRecord, session: HarnessSession) {
  return {
    ...record,
    modeId: session.getMode().id,
    modelId: session.getModelId(),
    state: session.getState() as Record<string, unknown>,
    pending: session.listPendingItems(),
    isBusy: session.isBusy(),
    queueDepth: session.getQueueDepth(),
    currentRunId: session.getCurrentRunId(),
    currentTraceId: session.getCurrentTraceId(),
  };
}

function streamAsyncIterable(subscription: Awaited<ReturnType<HarnessSession['subscribeToThread']>>): ReadableStream {
  const encoder = new TextEncoder();
  const iterator = subscription.stream[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) {
        subscription.unsubscribe();
        controller.close();
        return;
      }

      controller.enqueue(encoder.encode(`${JSON.stringify(next.value)}\n`));
    },
    async cancel() {
      subscription.abort();
      subscription.unsubscribe();
      await iterator.return?.();
    },
  });
}

export const LIST_HARNESSES_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses',
  responseType: 'json',
  responseSchema: listHarnessesResponseSchema,
  summary: 'List harnesses',
  description: 'Lists registered Harness V1 runtimes.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      return {
        harnesses: getHarnessEntries(mastra).map(([id, harness]) => serializeHarness(id, harness)),
      };
    } catch (error) {
      return handleError(error, 'Error listing harnesses');
    }
  },
});

export const GET_HARNESS_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses/:harnessId',
  responseType: 'json',
  pathParamSchema: harnessIdPathParams,
  responseSchema: getHarnessResponseSchema,
  summary: 'Get harness',
  description: 'Gets a registered Harness V1 runtime by registry key or owner id.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId }) => {
    try {
      const { id, harness } = getHarnessByKeyOrId(mastra, harnessId);
      return { harness: serializeHarness(id, harness) };
    } catch (error) {
      return handleError(error, 'Error getting harness');
    }
  },
});

export const LIST_HARNESS_MODES_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses/:harnessId/modes',
  responseType: 'json',
  pathParamSchema: harnessIdPathParams,
  responseSchema: listHarnessModesResponseSchema,
  summary: 'List harness modes',
  description: 'Lists configured modes for a Harness V1 runtime.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      return { modes: harness.listModes().map(serializeMode) };
    } catch (error) {
      return handleError(error, 'Error listing harness modes');
    }
  },
});

export const LIST_HARNESS_SESSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses/:harnessId/sessions',
  responseType: 'json',
  pathParamSchema: harnessIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema,
  responseSchema: listHarnessSessionsResponseSchema,
  summary: 'List harness sessions',
  description: 'Lists persisted sessions for a Harness V1 runtime.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, resourceId, threadId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const sessions = (await harness.listSessions()).filter(session => {
        if (resourceId && session.resourceId !== resourceId) return false;
        if (threadId && session.threadId !== threadId) return false;
        return true;
      });
      return { sessions };
    } catch (error) {
      return handleError(error, 'Error listing harness sessions');
    }
  },
});

export const CREATE_HARNESS_SESSION_ROUTE = createRoute({
  method: 'POST',
  path: '/harnesses/:harnessId/sessions',
  responseType: 'json',
  pathParamSchema: harnessIdPathParams,
  bodySchema: createHarnessSessionBodySchema,
  responseSchema: getHarnessSessionResponseSchema,
  summary: 'Create or open harness session',
  description: 'Creates or opens the Harness V1 session for a resource/thread pair.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, resourceId, threadId, modeId, modelId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const session = await harness.session({ resourceId, threadId, modeId, modelId });
      const record = await harness.getSessionRecord({ sessionId: session.id, resourceId });
      return { session: serializeSession(record, session) };
    } catch (error) {
      return handleError(error, 'Error creating harness session');
    }
  },
});

export const GET_HARNESS_SESSION_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses/:harnessId/sessions/:sessionId',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  responseSchema: getHarnessSessionResponseSchema,
  summary: 'Get harness session',
  description: 'Gets a Harness V1 session by id.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const record = await getSessionRecordOrThrow(harness, sessionId, resourceId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      return { session: serializeSession(record, session) };
    } catch (error) {
      return handleError(error, 'Error getting harness session');
    }
  },
});

export const SWITCH_HARNESS_SESSION_MODE_ROUTE = createRoute({
  method: 'POST',
  path: '/harnesses/:harnessId/sessions/:sessionId/mode',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  bodySchema: switchHarnessSessionModeBodySchema,
  responseSchema: getHarnessSessionResponseSchema,
  summary: 'Switch harness session mode',
  description: 'Switches the active mode for a Harness V1 session.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId, modeId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const mode = harness.getMode(modeId);
      if (!mode) {
        throw new HTTPException(404, { message: `Harness mode "${modeId}" was not found` });
      }

      const record = await getSessionRecordOrThrow(harness, sessionId, resourceId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      session.setMode(mode);
      return { session: serializeSession(record, session) };
    } catch (error) {
      return handleError(error, 'Error switching harness session mode');
    }
  },
});

export const SWITCH_HARNESS_SESSION_MODEL_ROUTE = createRoute({
  method: 'POST',
  path: '/harnesses/:harnessId/sessions/:sessionId/model',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  bodySchema: switchHarnessSessionModelBodySchema,
  responseSchema: getHarnessSessionResponseSchema,
  summary: 'Switch harness session model',
  description: 'Switches the active model for a Harness V1 session.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId, modelId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const record = await getSessionRecordOrThrow(harness, sessionId, resourceId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      session.setModelId(modelId);
      return { session: serializeSession(record, session) };
    } catch (error) {
      return handleError(error, 'Error switching harness session model');
    }
  },
});

export const GET_HARNESS_SESSION_THREAD_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses/:harnessId/sessions/:sessionId/thread',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  responseSchema: getHarnessSessionThreadResponseSchema,
  summary: 'Get harness session thread',
  description: 'Gets the memory thread backing a Harness V1 session.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      return { thread: await session.getThread() };
    } catch (error) {
      return handleError(error, 'Error getting harness session thread');
    }
  },
});

export const SEND_HARNESS_SESSION_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/harnesses/:harnessId/sessions/:sessionId/messages',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  bodySchema: sendHarnessSessionMessageBodySchema,
  responseSchema: sendHarnessSessionMessageResponseSchema,
  summary: 'Send harness session message',
  description: 'Sends a message signal to a Harness V1 session.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId, messages, options }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      const result = await session.sendMessage({ messages, ...(options ?? {}) });
      return { result };
    } catch (error) {
      return handleError(error, 'Error sending harness session message');
    }
  },
});

export const QUEUE_HARNESS_SESSION_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/harnesses/:harnessId/sessions/:sessionId/messages/queue',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  bodySchema: sendHarnessSessionMessageBodySchema,
  responseSchema: sendHarnessSessionMessageResponseSchema,
  summary: 'Queue harness session message',
  description: 'Queues a message signal for a Harness V1 session.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId, messages, options }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      const result = await session.queueMessage({ messages, ...(options ?? {}) });
      return { result };
    } catch (error) {
      return handleError(error, 'Error queueing harness session message');
    }
  },
});

export const STREAM_HARNESS_SESSION_MESSAGE_ROUTE = createRoute({
  method: 'POST',
  path: '/harnesses/:harnessId/sessions/:sessionId/stream',
  responseType: 'stream',
  streamFormat: 'stream',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  bodySchema: sendHarnessSessionMessageBodySchema,
  summary: 'Stream harness session message',
  description: 'Subscribes to a Harness V1 thread and sends a message signal.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId, messages, options }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      const subscription = await session.subscribeToThread();
      try {
        await session.sendMessage({ messages, ...(options ?? {}) });
      } catch (error) {
        subscription.abort();
        subscription.unsubscribe();
        throw error;
      }

      return streamAsyncIterable(subscription);
    } catch (error) {
      return handleError(error, 'Error streaming harness session message');
    }
  },
});

export const GET_HARNESS_SESSION_MESSAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/harnesses/:harnessId/sessions/:sessionId/messages',
  responseType: 'json',
  pathParamSchema: harnessSessionIdPathParams,
  queryParamSchema: listHarnessSessionsQuerySchema.pick({ resourceId: true }),
  responseSchema: getHarnessSessionMessagesResponseSchema,
  summary: 'Get harness session messages',
  description: 'Gets the messages for the memory thread backing a Harness V1 session.',
  tags: ['Harnesses'],
  requiresAuth: true,
  handler: async ({ mastra, harnessId, sessionId, resourceId }) => {
    try {
      const { harness } = getHarnessByKeyOrId(mastra, harnessId);
      const session = await getSessionOrThrow(harness, sessionId, resourceId);
      return { messages: await session.getMessages() };
    } catch (error) {
      return handleError(error, 'Error getting harness session messages');
    }
  },
});
