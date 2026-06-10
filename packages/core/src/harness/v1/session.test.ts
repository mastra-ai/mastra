import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory } from '../../memory';
import { MastraCompositeStore } from '../../storage';
import type { StorageCloneThreadInput } from '../../storage';
import { HarnessStorage } from '../../storage/domains/harness';
import type { SessionRecord } from '../../storage/domains/harness';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

class RecordingHarnessStorage extends HarnessStorage {
  readonly records = new Map<string, SessionRecord>();
  initCalls = 0;

  override async init(): Promise<void> {
    this.initCalls += 1;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.records.clear();
  }

  async loadSession(sessionId: string): Promise<SessionRecord | null> {
    return this.records.get(sessionId) ?? null;
  }

  async saveSession(record: SessionRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.records.values()];
  }
}

const createMessage = (id: string, threadId = 'thread-1'): MastraDBMessage => ({
  id,
  role: 'user',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  threadId,
  resourceId: 'resource-1',
  content: { format: 2, parts: [{ type: 'text', text: `message ${id}` }] },
});

const createMemory = () => {
  const clonedThread = {
    id: 'thread-2',
    resourceId: 'resource-1',
    title: 'Clone',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  const messages = [createMessage('message-1')];
  return {
    getThreadById: vi.fn().mockResolvedValue(clonedThread),
    recall: vi.fn().mockResolvedValue({ messages }),
    saveMessages: vi.fn().mockImplementation(async ({ messages }) => ({ messages })),
    cloneThread: vi.fn().mockImplementation(async ({ newThreadId, resourceId, title }: StorageCloneThreadInput) => ({
      thread: {
        ...clonedThread,
        id: newThreadId ?? clonedThread.id,
        resourceId: resourceId ?? clonedThread.resourceId,
        title: title ?? clonedThread.title,
      },
      clonedMessages: messages,
      messageIdMap: { 'message-1': 'message-2' },
    })),
  } as unknown as MastraMemory;
};

const createAgent = (overrides: Partial<Agent> = {}) =>
  ({
    listTools: vi.fn().mockResolvedValue({}),
    getActiveThreadRunId: vi.fn().mockReturnValue(null),
    subscribeToThread: vi.fn().mockResolvedValue({
      activeRunId: () => null,
      abort: () => false,
      unsubscribe: () => undefined,
      stream: (async function* () {})(),
    }),
    sendMessage: vi.fn().mockReturnValue({ accepted: true }),
    queueMessage: vi.fn().mockReturnValue({ accepted: true, queued: true }),
    ...overrides,
  }) as unknown as Agent;

const createHarness = (
  memory: MastraMemory,
  storage = new RecordingHarnessStorage(),
  ownerId?: string,
  agent = createAgent(),
) => ({
  storage,
  memory,
  harness: new Harness({
    agent,
    ownerId,
    storage,
    memory,
    modes: [
      { id: 'build', defaultModelId: 'test-build-model' },
      { id: 'plan', defaultModelId: 'test-plan-model' },
    ],
    defaultModeId: 'build',
  }),
  agent,
});

describe('Harness.session()', () => {
  it('saves a fresh thread session record', async () => {
    const { harness, storage } = createHarness(createMemory());

    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'plan',
      modelId: 'test-model',
    });

    expect(session.getMode()).toMatchObject({ id: 'plan' });
    expect(session.getModelId()).toBe('test-model');
    expect(session.ownerId).toBe(harness.ownerId);
    expect([...storage.records.values()]).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^sess-[a-f0-9]{32}$/),
        ownerId: harness.ownerId,
        threadId: 'thread-1',
        resourceId: 'resource-1',
        origin: 'top-level',
        source: { type: 'top-level' },
        subagentDepth: 0,
        modeId: 'plan',
        modelId: 'test-model',
        pending: [],
        createdAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
      }),
    ]);
  });

  it('loads the existing record for the same resource and thread', async () => {
    const { harness, storage } = createHarness(createMemory());

    await harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'plan', modelId: 'test-model' });
    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'build',
      modelId: 'ignored-model',
    });

    expect(session.getMode()).toMatchObject({ id: 'plan' });
    expect(session.getModelId()).toBe('test-model');
    expect(storage.records).toHaveLength(1);
  });

  it('loads a session by id', async () => {
    const { harness, storage } = createHarness(createMemory());
    await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const [record] = storage.records.values();

    const session = await harness.session({ sessionId: record!.id, resourceId: 'resource-1' });

    expect(session.getMode()).toMatchObject({ id: 'build' });
    expect(session.getModelId()).toBe('test-build-model');
  });

  it('uses top-level storage', async () => {
    const storage = new RecordingHarnessStorage();
    const harness = new Harness({
      agent: createAgent(),
      storage,
      memory: createMemory(),
      modes: [{ id: 'build', defaultModelId: 'test-build-model' }],
      defaultModeId: 'build',
    });

    await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(storage.records).toHaveLength(1);
    expect(session.getMode()).toMatchObject({ id: 'build' });
  });

  it('resolves the harness domain from a top-level storage adapter', async () => {
    const storage = new RecordingHarnessStorage();
    const storageAdapter = new MastraCompositeStore({
      id: 'storage-adapter',
      domains: { harness: storage },
    });
    const harness = new Harness({
      agents: {},
      storage: storageAdapter,
      memory: createMemory(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'test-build-model' }],
      defaultModeId: 'build',
    });

    await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(storage.initCalls).toBe(1);
    expect(storage.records).toHaveLength(1);
    expect(session.getMode()).toMatchObject({ id: 'build' });
  });

  it('clones a session with a new memory thread', async () => {
    const memory = createMemory();
    const { harness, storage } = createHarness(memory);
    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'plan',
      modelId: 'test-model',
    });

    const clone = await session.clone({ threadId: 'thread-2', title: 'Clone', metadata: { forkedSubagent: true } });

    expect(clone.id).not.toBe(session.id);
    expect(clone.threadId).toBe('thread-2');
    expect(clone.resourceId).toBe('resource-1');
    expect(clone.getMode()).toMatchObject({ id: 'plan' });
    expect(clone.getModelId()).toBe('test-model');
    expect(memory.cloneThread).toHaveBeenCalledWith({
      sourceThreadId: 'thread-1',
      newThreadId: 'thread-2',
      resourceId: 'resource-1',
      title: 'Clone',
      metadata: { forkedSubagent: true },
      options: undefined,
    });
    expect(storage.records).toHaveLength(1);
  });

  it('passes messageLimit 0 when cloning a session', async () => {
    const memory = createMemory();
    const { harness } = createHarness(memory);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    await session.clone({ messageLimit: 0 });

    expect(memory.cloneThread).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { messageLimit: 0 },
      }),
    );
  });

  it('rejects unknown modes before saving a fresh thread session record', async () => {
    const { harness, storage } = createHarness(createMemory());

    await expect(
      harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'missing-mode' }),
    ).rejects.toThrow('cannot use unknown mode "missing-mode"');
    expect(storage.records).toHaveLength(0);
  });

  it('clones a session with overrides', async () => {
    const memory = createMemory();
    const { harness, storage } = createHarness(memory);
    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'plan',
      modelId: 'test-model',
    });

    const clone = await harness.cloneSession(session, {
      sessionId: 'session-2',
      threadId: 'thread-2',
      resourceId: 'resource-2',
      parentSessionId: 'parent-session',
      origin: 'subagent-tool',
      modeId: 'build',
      modelId: 'override-model',
    });

    expect(clone.id).toBe('session-2');
    expect(clone.threadId).toBe('thread-2');
    expect(clone.resourceId).toBe('resource-2');
    expect(clone.getMode()).toMatchObject({ id: 'build' });
    expect(clone.getModelId()).toBe('override-model');
    expect(clone.ownerId).toBe(harness.ownerId);
    expect(storage.records.get('session-2')).toEqual(
      expect.objectContaining({
        id: 'session-2',
        ownerId: harness.ownerId,
        threadId: 'thread-2',
        resourceId: 'resource-2',
        parentSessionId: 'parent-session',
        origin: 'subagent-tool',
        source: { type: 'subagent-tool', parentSessionId: 'parent-session' },
        subagentDepth: 1,
        modeId: 'build',
        modelId: 'override-model',
        pending: [],
        createdAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
      }),
    );
  });

  it('loads the backing memory thread', async () => {
    const memory = createMemory();
    const { harness } = createHarness(memory);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    const thread = await session.getThread();

    expect(memory.getThreadById).toHaveBeenCalledWith({ threadId: 'thread-1' });
    expect(thread).toMatchObject({ id: 'thread-2' });
  });

  it('gets messages from memory', async () => {
    const memory = createMemory();
    const { harness } = createHarness(memory);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    const messages = await session.getMessages();

    expect(memory.recall).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(messages).toEqual([createMessage('message-1')]);
  });

  it('saves messages to memory', async () => {
    const memory = createMemory();
    const { harness } = createHarness(memory);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const messages = [createMessage('message-2')];

    const result = await session.saveMessages(messages);

    expect(memory.saveMessages).toHaveBeenCalledWith({ messages });
    expect(result.messages).toEqual(messages);
  });

  it('hydrates session state and pending projections from durable records', async () => {
    const storage = new RecordingHarnessStorage();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    await storage.saveSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      origin: 'top-level',
      modeId: 'build',
      modelId: 'test-build-model',
      state: { count: 2 },
      pending: [
        {
          id: 'pending-1',
          kind: 'question',
          status: 'pending',
          sessionId: 'session-1',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      createdAt,
      lastActivityAt: createdAt,
    });
    const harness = new Harness({
      agent: createAgent(),
      ownerId: 'owner-1',
      storage,
      memory: createMemory(),
      modes: [{ id: 'build', defaultModelId: 'test-build-model' }],
      defaultModeId: 'build',
    });

    const session = await harness.session({ sessionId: 'session-1', resourceId: 'resource-1' });

    expect(session.getState()).toEqual({ count: 2 });
    expect(session.isBusy()).toBe(true);
    expect(session.getQueueDepth()).toBe(1);
    expect(session.getCurrentRunId()).toBeNull();
    expect(session.getCurrentTraceId()).toBeNull();
  });

  it('persists state and pending item changes without storing live projections', async () => {
    const { harness, storage } = createHarness(createMemory());
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    await session.setState({ count: 1 } as never);
    await session.registerPendingItem({ id: 'pending-1', kind: 'plan-approval', status: 'pending' });

    expect(session.isBusy()).toBe(true);
    expect(session.getQueueDepth()).toBe(1);
    expect(storage.records.get(session.id)).toMatchObject({
      state: { count: 1 },
    });
    expect(storage.records.get(session.id)).not.toHaveProperty('live');

    await session.removePendingItem('pending-1');

    expect(session.isBusy()).toBe(false);
    expect(session.getQueueDepth()).toBe(0);
  });

  it('responds to session-owned pending items and removes them from the queue', async () => {
    const storage = new RecordingHarnessStorage();
    const memory = createMemory();
    const harness = new Harness({
      agent: createAgent(),
      storage,
      memory,
      runtimeCompatibilityGeneration: 'runtime-v1',
      modes: [
        { id: 'build', defaultModelId: 'test-build-model' },
        { id: 'plan', defaultModelId: 'test-plan-model' },
      ],
      defaultModeId: 'build',
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    await session.registerPendingItem({
      id: 'pending-question',
      kind: 'question',
      status: 'pending',
      payload: { question: 'continue?' },
    });

    const updated = await session.respondToQuestion('pending-question', { answer: 'yes' });

    expect(updated).toMatchObject({
      id: 'pending-question',
      kind: 'question',
      status: 'responded',
      response: { answer: 'yes' },
      runtimeCompatibilityGeneration: 'runtime-v1',
    });
    expect(session.getQueueDepth()).toBe(0);
    expect(storage.records.get(session.id)).toMatchObject({
      pending: [expect.objectContaining({ id: 'pending-question', status: 'responded' })],
    });
  });

  it('applies pending plan approval mode transitions at the session boundary', async () => {
    const storage = new RecordingHarnessStorage();
    const harness = new Harness({
      agent: createAgent(),
      storage,
      memory: createMemory(),
      modes: [
        { id: 'build', defaultModelId: 'test-build-model' },
        { id: 'plan', defaultModelId: 'test-plan-model', transitionsTo: 'build' },
      ],
      defaultModeId: 'plan',
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'plan' });
    await session.registerPendingItem({
      id: 'pending-plan',
      kind: 'plan-approval',
      status: 'pending',
      payload: { plan: 'Ship it', transitionModeId: 'build' },
    });

    const updated = await session.respondToPlanApproval('pending-plan', { approved: true });

    expect(session.getMode().id).toBe('build');
    expect(updated).toMatchObject({
      id: 'pending-plan',
      status: 'responded',
      response: { approved: true, resumeResult: { transitionModeId: 'build', modeChanged: true } },
    });
    expect(storage.records.get(session.id)).toMatchObject({
      modeId: 'build',
    });
  });
});

describe('Harness events', () => {
  it('emits session_created only for newly persisted sessions', async () => {
    const { harness } = createHarness(createMemory());
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'plan',
      modelId: 'test-model',
    });
    await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'build',
      modelId: 'ignored-model',
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'session_created',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      modeId: 'plan',
      modelId: 'test-model',
    });
    expect(events[0]?.id).toMatch(/^harness-v1:[0-9a-f-]{36}:0$/);
    expect(events[0]?.timestamp).toEqual(expect.any(Number));
    expect(session.id).toMatch(/^sess-[a-f0-9]{32}$/);
  });

  it('emits mode and model changes from sessions', async () => {
    const { harness } = createHarness(createMemory());
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });
    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'build',
      modelId: 'model-1',
    });
    events.length = 0;

    session.setModelId('model-2');
    session.setMode({ id: 'plan', defaultModelId: 'test-plan-model' });

    expect(events).toEqual([
      expect.objectContaining({
        type: 'model_changed',
        sessionId: session.id,
        modelId: 'model-2',
        previousModelId: 'model-1',
      }),
      expect.objectContaining({
        type: 'mode_changed',
        sessionId: session.id,
        modeId: 'plan',
        previousModeId: 'build',
      }),
    ]);
  });

  it('emits thread_cloned from session.clone and session_created from harness.cloneSession', async () => {
    const { harness } = createHarness(createMemory());
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    events.length = 0;

    await session.clone({ threadId: 'thread-2', title: 'Clone' });
    await harness.cloneSession(session, { sessionId: 'session-2', threadId: 'thread-3' });

    expect(events).toEqual([
      expect.objectContaining({
        type: 'thread_cloned',
        sessionId: session.id,
        threadId: 'thread-2',
        resourceId: 'resource-1',
        sourceThreadId: 'thread-1',
        title: 'Clone',
      }),
      expect.objectContaining({
        type: 'thread_cloned',
        sessionId: session.id,
        threadId: 'thread-3',
        resourceId: 'resource-1',
        sourceThreadId: 'thread-1',
      }),
      expect.objectContaining({
        type: 'session_created',
        threadId: 'thread-3',
        resourceId: 'resource-1',
        parentSessionId: session.id,
      }),
    ]);
  });

  it('emits permission approval events and resolves pending tool approvals', async () => {
    const events: HarnessEvent[] = [];
    const onPermissionRequested = vi.fn();
    const storage = new RecordingHarnessStorage();
    const toolExecute = vi.fn(async () => ({ ok: true }));
    const agent = createAgent({
      listTools: vi.fn().mockResolvedValue({
        guarded: { id: 'guarded', description: 'guarded', parameters: {} as never, execute: toolExecute },
      }),
      getActiveThreadRunId: vi.fn().mockReturnValue('run-1'),
      sendMessage: vi.fn().mockReturnValue({ accepted: true, runId: 'run-1' }),
      approveToolCallGenerate: vi.fn().mockResolvedValue({ resumed: true }),
      declineToolCallGenerate: vi.fn().mockResolvedValue({ declined: true }),
    } as Partial<Agent>);
    const harness = new Harness({
      agent,
      storage,
      memory: createMemory(),
      modes: [{ id: 'build', defaultModelId: 'test-build-model' }],
      defaultModeId: 'build',
      defaultPermissionPolicy: 'ask',
      toolCategories: { guarded: 'execute' },
      onPermissionRequested,
    });
    harness.subscribe(event => {
      events.push(event);
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    await session.sendMessage({ messages: 'call the guarded tool' });
    events.length = 0;

    const sendTarget = (agent.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0]![1] as {
      ifIdle: { streamOptions: { toolsets: { harness: Record<string, { execute: (input: unknown, context: never) => Promise<unknown> }> } } };
    };
    const result = await sendTarget.ifIdle.streamOptions.toolsets.harness.guarded!.execute(
      { command: 'ship' },
      { requestContext: undefined, workspace: undefined } as never,
    );

    expect(result).toMatchObject({ isError: false, status: 'pending', pendingItemId: expect.any(String) });
    const pendingItemId = (result as { pendingItemId: string }).pendingItemId;
    expect(session.listPendingItems()).toEqual([
      expect.objectContaining({
        id: pendingItemId,
        kind: 'tool-approval',
        status: 'pending',
        runId: 'run-1',
        payload: expect.objectContaining({
          source: 'permission-gate',
          toolName: 'guarded',
          category: 'execute',
          args: { command: 'ship' },
        }),
      }),
    ]);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'permission.requested',
        sessionId: session.id,
        payload: expect.objectContaining({
          pendingItemId,
          toolName: 'guarded',
          category: 'execute',
          decision: 'pendingApproval',
          policy: 'ask',
          reasons: ['policy'],
        }),
      }),
    ]);
    expect(onPermissionRequested).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingItemId,
        toolName: 'guarded',
        category: 'execute',
        result: expect.objectContaining({ decision: 'pendingApproval' }),
      }),
    );

    events.length = 0;
    const updated = await session.approveToolCall(pendingItemId, 'allow');

    expect(updated).toMatchObject({
      id: pendingItemId,
      kind: 'tool-approval',
      status: 'responded',
      response: { approved: true, resumeResult: { resumed: true } },
    });
    expect(agent.approveToolCallGenerate).toHaveBeenCalledWith({
      runId: 'run-1',
      toolCallId: undefined,
      requestContext: expect.any(Object),
    });
    expect(toolExecute).not.toHaveBeenCalled();
    expect(session.getQueueDepth()).toBe(0);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'permission.resolved',
        sessionId: session.id,
        payload: { pendingItemId, approved: true, decision: 'allow' },
      }),
    ]);
  });
});

describe('Harness.listSessions()', () => {
  it('returns all sessions across resources', async () => {
    const { harness } = createHarness(createMemory());

    await harness.session({ threadId: 'thread-1', resourceId: 'resource-1', modeId: 'build' });
    await harness.session({ threadId: 'thread-2', resourceId: 'resource-2', modeId: 'plan' });

    const sessions = await harness.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.resourceId).sort()).toEqual(['resource-1', 'resource-2']);
  });

  it('returns an empty array when no sessions exist', async () => {
    const { harness } = createHarness(createMemory());
    const sessions = await harness.listSessions();
    expect(sessions).toEqual([]);
  });
});

describe('Harness.ownerId', () => {
  it('uses a configured ownerId when provided', async () => {
    const { harness, storage } = createHarness(createMemory(), new RecordingHarnessStorage(), 'owner-custom');

    expect(harness.ownerId).toBe('owner-custom');

    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const [record] = storage.records.values();

    expect(session.ownerId).toBe('owner-custom');
    expect(record!.ownerId).toBe('owner-custom');
  });

  it('generates a unique ownerId per Harness instance when not configured', () => {
    const { harness: a } = createHarness(createMemory());
    const { harness: b } = createHarness(createMemory());

    expect(a.ownerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.ownerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.ownerId).not.toBe(b.ownerId);
  });

  it('propagates the ownerId to cloned sessions on session.clone()', async () => {
    const memory = createMemory();
    const { harness } = createHarness(memory);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    const clone = await session.clone({ threadId: 'thread-2' });

    expect(clone.ownerId).toBe(harness.ownerId);
  });

  it('reflects the persisted ownerId when reloading a session created by another harness', async () => {
    const memory = createMemory();
    const storage = new RecordingHarnessStorage();
    const { harness: creator } = createHarness(memory, storage);
    await creator.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const [record] = storage.records.values();

    const { harness: reader } = createHarness(createMemory(), storage);
    const session = await reader.session({ sessionId: record!.id, resourceId: 'resource-1' });

    expect(session.ownerId).toBe(creator.ownerId);
    expect(session.ownerId).not.toBe(reader.ownerId);
  });

  it('exposes sendMessage instead of signal', async () => {
    const { harness } = createHarness(createMemory());
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(typeof session.sendMessage).toBe('function');
    expect((session as unknown as { signal?: unknown }).signal).toBeUndefined();
  });

  it('subscribes to the session thread through the backing agent', async () => {
    const subscription = {
      activeRunId: () => null,
      abort: () => false,
      unsubscribe: () => undefined,
      stream: (async function* () {})(),
    };
    const agent = createAgent({ subscribeToThread: vi.fn().mockResolvedValue(subscription) });
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    await expect(session.subscribeToThread()).resolves.toBe(subscription);
    expect(agent.subscribeToThread).toHaveBeenCalledWith({ resourceId: 'resource-1', threadId: 'thread-1' });
  });

  it('sends messages through the agent thread runtime', async () => {
    const agent = createAgent({
      generate: vi.fn(),
      sendMessage: vi.fn().mockReturnValue({ accepted: true, runId: 'run-1' }),
    } as Partial<Agent>);
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    await expect(session.sendMessage({ messages: 'hello' })).resolves.toEqual({ accepted: true, runId: 'run-1' });

    expect(agent.sendMessage).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        ifIdle: expect.objectContaining({ behavior: 'wake' }),
      }),
    );
    expect(agent.generate).not.toHaveBeenCalled();
  });

  it('queues messages through the agent thread runtime', async () => {
    const agent = createAgent({ queueMessage: vi.fn().mockReturnValue({ accepted: true, queued: true }) });
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    await expect(session.queueMessage({ messages: 'queued' })).resolves.toEqual({ accepted: true, queued: true });

    expect(agent.queueMessage).toHaveBeenCalledWith(
      'queued',
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        ifIdle: expect.objectContaining({
          behavior: 'wake',
          streamOptions: expect.objectContaining({ activeTools: undefined }),
        }),
      }),
    );
  });
});
