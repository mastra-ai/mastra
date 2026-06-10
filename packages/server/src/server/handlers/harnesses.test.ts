import type { SessionRecord } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import type { HTTPException } from '../http-exception';
import {
  CREATE_HARNESS_SESSION_ROUTE,
  GET_HARNESS_ROUTE,
  GET_HARNESS_SESSION_MESSAGES_ROUTE,
  GET_HARNESS_SESSION_ROUTE,
  GET_HARNESS_SESSION_THREAD_ROUTE,
  LIST_HARNESS_MODES_ROUTE,
  LIST_HARNESS_SESSIONS_ROUTE,
  LIST_HARNESSES_ROUTE,
  QUEUE_HARNESS_SESSION_MESSAGE_ROUTE,
  SEND_HARNESS_SESSION_MESSAGE_ROUTE,
  STREAM_HARNESS_SESSION_MESSAGE_ROUTE,
  SWITCH_HARNESS_SESSION_MODE_ROUTE,
  SWITCH_HARNESS_SESSION_MODEL_ROUTE,
} from './harnesses';

function createMastra() {
  const thread = {
    id: 'thread-1',
    resourceId: 'resource-1',
    title: 'Thread 1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const messages = [
    {
      id: 'message-1',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];
  const sessions = new Map<string, SessionRecord>();
  const modes = [
    {
      id: 'default',
      defaultModelId: 'test-default-model',
      description: 'Default mode',
      metadata: { label: 'Default' },
    },
    { id: 'plan', defaultModelId: 'test-plan-model', transitionsTo: 'default' },
  ];

  const createSession = (record: SessionRecord) => {
    const session = {
      id: record.id,
      getState: () => record.state ?? {},
      listPendingItems: () => record.pending ?? [],
      isBusy: () => false,
      getQueueDepth: () => 0,
      getCurrentRunId: () => null,
      getCurrentTraceId: () => null,
      getModelId: () => record.modelId,
      getMode: () => modes.find(mode => mode.id === record.modeId)!,
      setModelId: (modelId: string) => {
        record.modelId = modelId;
      },
      setMode: (mode: (typeof modes)[number]) => {
        record.modeId = mode.id;
      },
      getThread: async () => thread,
      getMessages: async () => messages,
      subscribeToThread: async () => ({
        stream: (async function* () {
          yield { type: 'message', text: 'hello from stream' };
        })(),
        abort: () => true,
        unsubscribe: () => undefined,
      }),
      sendMessage: async (options: unknown) => ({ accepted: true, options }),
      queueMessage: async (options: unknown) => ({ accepted: true, queued: true, options }),
    };
    return session;
  };

  const harness = {
    ownerId: 'owner-1',
    listModes: () => modes,
    getMode: (modeId: string) => modes.find(mode => mode.id === modeId),
    listSessions: async () => [...sessions.values()],
    getSessionRecord: async ({ sessionId, resourceId }: { sessionId: string; resourceId?: string }) => {
      const record = sessions.get(sessionId);
      if (!record) {
        throw new Error(`Harness session "${sessionId}" was not found`);
      }
      if (resourceId && record.resourceId !== resourceId) {
        throw new Error(`Harness session "${sessionId}" does not belong to resource "${resourceId}"`);
      }
      return record;
    },
    session: async (opts: {
      sessionId?: string;
      resourceId?: string;
      threadId?: string;
      modeId?: string;
      modelId?: string;
    }) => {
      if (opts.sessionId) {
        const record = sessions.get(opts.sessionId);
        if (!record) {
          throw new Error(`Harness session "${opts.sessionId}" was not found`);
        }
        return createSession(record);
      }

      const id = 'sess-1';
      const record: SessionRecord = {
        id,
        ownerId: 'owner-1',
        resourceId: opts.resourceId!,
        threadId: opts.threadId!,
        origin: 'top-level',
        source: { type: 'top-level' },
        modeId: opts.modeId ?? 'default',
        modelId: opts.modelId ?? 'test-default-model',
        pending: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        lastActivityAt: new Date('2026-01-01T00:00:00.000Z'),
      };
      sessions.set(record.id, record);
      return createSession(record);
    },
  };

  return {
    listHarnesses: () => ({ main: harness }),
    getHarnessById: (id: string) => {
      if (id === harness.ownerId) {
        return harness;
      }
      throw new Error(`Harness with id ${id} not found`);
    },
  };
}

describe('Harness handlers', () => {
  it('lists registered harnesses and modes', async () => {
    const mastra = createMastra();

    await expect(LIST_HARNESSES_ROUTE.handler({ mastra } as any)).resolves.toEqual({
      harnesses: [
        {
          id: 'main',
          ownerId: 'owner-1',
          modes: [
            {
              id: 'default',
              defaultModelId: 'test-default-model',
              description: 'Default mode',
              instructions: undefined,
              transitionsTo: undefined,
              metadata: { label: 'Default' },
            },
            {
              id: 'plan',
              defaultModelId: 'test-plan-model',
              description: undefined,
              instructions: undefined,
              transitionsTo: 'default',
              metadata: undefined,
            },
          ],
        },
      ],
    });

    const harness = await GET_HARNESS_ROUTE.handler({ mastra, harnessId: 'main' } as any);
    expect(harness.harness.ownerId).toBe('owner-1');

    const modes = await LIST_HARNESS_MODES_ROUTE.handler({ mastra, harnessId: 'owner-1' } as any);
    expect(modes.modes.map(mode => mode.id)).toEqual(['default', 'plan']);
  });

  it('creates, loads, lists, and reads backing memory for sessions', async () => {
    const mastra = createMastra();

    const created = await CREATE_HARNESS_SESSION_ROUTE.handler({
      mastra,
      harnessId: 'main',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      modeId: 'plan',
      modelId: 'test-model',
    } as any);

    expect(created.session).toMatchObject({
      ownerId: 'owner-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      modeId: 'plan',
      modelId: 'test-model',
      pending: [],
      isBusy: false,
      queueDepth: 0,
      currentRunId: null,
      currentTraceId: null,
    });

    const listed = await LIST_HARNESS_SESSIONS_ROUTE.handler({
      mastra,
      harnessId: 'main',
      resourceId: 'resource-1',
    } as any);
    expect(listed.sessions).toHaveLength(1);
    expect(listed.sessions[0]!.id).toBe(created.session.id);

    const loaded = await GET_HARNESS_SESSION_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
    } as any);
    expect(loaded.session.id).toBe(created.session.id);

    const thread = await GET_HARNESS_SESSION_THREAD_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
    } as any);
    expect(thread.thread).toMatchObject({ id: 'thread-1' });

    const messages = await GET_HARNESS_SESSION_MESSAGES_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
    } as any);
    expect(messages.messages).toHaveLength(1);
  });

  it('switches session mode and model', async () => {
    const mastra = createMastra();
    const created = await CREATE_HARNESS_SESSION_ROUTE.handler({
      mastra,
      harnessId: 'main',
      resourceId: 'resource-1',
      threadId: 'thread-1',
    } as any);

    const modeResult = await SWITCH_HARNESS_SESSION_MODE_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
      modeId: 'plan',
    } as any);
    expect(modeResult.session.modeId).toBe('plan');

    const modelResult = await SWITCH_HARNESS_SESSION_MODEL_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
      modelId: 'test-next-model',
    } as any);
    expect(modelResult.session.modelId).toBe('test-next-model');
  });

  it('sends, queues, and streams session messages', async () => {
    const mastra = createMastra();
    const created = await CREATE_HARNESS_SESSION_ROUTE.handler({
      mastra,
      harnessId: 'main',
      resourceId: 'resource-1',
      threadId: 'thread-1',
    } as any);

    const sent = await SEND_HARNESS_SESSION_MESSAGE_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
      messages: 'hello',
      options: { runId: 'run-1' },
    } as any);
    expect(sent.result).toMatchObject({ accepted: true });

    const queued = await QUEUE_HARNESS_SESSION_MESSAGE_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
      messages: 'queued hello',
    } as any);
    expect(queued.result).toMatchObject({ accepted: true, queued: true });

    const stream = await STREAM_HARNESS_SESSION_MESSAGE_ROUTE.handler({
      mastra,
      harnessId: 'main',
      sessionId: created.session.id,
      resourceId: 'resource-1',
      messages: 'stream hello',
    } as any);
    const reader = stream.getReader();
    const chunk = await reader.read();
    expect(new TextDecoder().decode(chunk.value)).toContain('hello from stream');
    reader.releaseLock();
    await stream.cancel();
  });

  it('returns 404 for missing sessions', async () => {
    await expect(
      GET_HARNESS_SESSION_ROUTE.handler({
        mastra: createMastra(),
        harnessId: 'main',
        sessionId: 'missing',
      } as any),
    ).rejects.toMatchObject({ status: 404 } satisfies Partial<HTTPException>);
  });
});
