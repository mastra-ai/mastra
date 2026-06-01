import { describe, expect, it, vi } from 'vitest';

import type { Agent } from '../../agent';
import type { MastraDBMessage } from '../../agent/message-list';
import type { MastraMemory } from '../../memory';
import type { StorageCloneThreadInput } from '../../storage';
import { HarnessStorage } from '../../storage/domains/harness';
import type { SessionRecord } from '../../storage/domains/harness';
import type { HarnessEvent } from './events';
import { Harness } from './harness';

class RecordingHarnessStorage extends HarnessStorage {
  readonly records = new Map<string, SessionRecord>();

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

const createAgent = (overrides: Partial<Agent> = {}) =>
  ({
    generate: vi.fn().mockResolvedValue({ text: 'ok', steps: [] }),
    stream: vi.fn().mockResolvedValue({ textStream: (async function* () {})() }),
    ...overrides,
  }) as unknown as Agent;

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

const createHarness = (
  memory: MastraMemory,
  storage = new RecordingHarnessStorage(),
  ownerId?: string,
  agent = createAgent(),
) => ({
  storage,
  memory,
  agent,
  harness: new Harness({
    agents: { default: agent },
    ownerId,
    storage,
    memory,
    modes: [
      { id: 'build', agentId: 'default', defaultModelId: 'test-build-model' },
      { id: 'plan', agentId: 'default', defaultModelId: 'test-plan-model' },
    ],
    defaultModeId: 'build',
  }),
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
      agents: { default: createAgent() },
      storage,
      memory: createMemory(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'test-build-model' }],
      defaultModeId: 'build',
    });

    await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

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
      agents: {},
      ownerId: 'owner-1',
      storage,
      memory: createMemory(),
      modes: [{ id: 'build', agentId: 'default', defaultModelId: 'test-build-model' }],
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
      agents: {},
      storage,
      memory,
      runtimeCompatibilityGeneration: 'runtime-v1',
      modes: [
        { id: 'build', agentId: 'default', defaultModelId: 'test-build-model' },
        { id: 'plan', agentId: 'default', defaultModelId: 'test-plan-model' },
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
      agents: {},
      storage,
      memory: createMemory(),
      modes: [
        { id: 'build', agentId: 'default', defaultModelId: 'test-build-model' },
        { id: 'plan', agentId: 'default', defaultModelId: 'test-plan-model', transitionsTo: 'build' },
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

describe('Session.message() and queue()', () => {
  it('calls agent.generate with session memory, mode defaults, and emits lifecycle events', async () => {
    const generate = vi.fn().mockResolvedValue({ text: 'generated', steps: [] });
    const agent = createAgent({ generate } as Partial<Agent>);
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });
    const session = await harness.session({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      modeId: 'plan',
      modelId: 'model-1',
    });
    session.setMode({
      id: 'plan',
      agentId: 'default',
      defaultModelId: 'zai-coding-plan/glm-5-turbo',
      instructions: 'Use plan mode.',
      additionalTools: { planTool: { description: 'Plan tool', execute: vi.fn() } } as never,
    });
    events.length = 0;

    const result = await session.message({
      content: 'hello',
      additionalTools: { localTool: { description: 'Local tool', execute: vi.fn() } } as never,
      maxSteps: 2,
    });

    expect(result).toEqual({ text: 'generated', steps: [] });
    expect(generate).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({
        memory: { thread: 'thread-1', resource: 'resource-1' },
        model: 'model-1',
        instructions: 'Use plan mode.',
        maxSteps: 2,
        toolsets: expect.objectContaining({
          'mode:plan:add': expect.any(Object),
          'call:additional': expect.any(Object),
        }),
        requestContext: expect.any(Object),
      }),
    );
    expect(events.map(event => event.type)).toEqual(['agent_start', 'agent_end']);
    expect(events[0]).toMatchObject({ type: 'agent_start', sessionId: session.id });
    expect(events[1]).toMatchObject({ type: 'agent_end', sessionId: session.id, reason: 'complete' });
  });

  it('calls agent.stream when stream is true', async () => {
    const streamResult = { textStream: (async function* () {})() };
    const stream = vi.fn().mockResolvedValue(streamResult);
    const agent = createAgent({ stream } as Partial<Agent>);
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });

    const result = await session.message({ content: 'stream me', stream: true });

    expect(result).toBe(streamResult);
    expect(stream).toHaveBeenCalledWith(
      'stream me',
      expect.objectContaining({ memory: { thread: 'thread-1', resource: 'resource-1' } }),
    );
  });

  it('emits an error lifecycle event when generation fails', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('nope'));
    const agent = createAgent({ generate } as Partial<Agent>);
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    events.length = 0;

    await expect(session.message({ content: 'fail' })).rejects.toThrow('nope');

    expect(events).toEqual([
      expect.objectContaining({ type: 'agent_start', sessionId: session.id }),
      expect.objectContaining({ type: 'agent_end', sessionId: session.id, reason: 'error', error: 'nope' }),
    ]);
  });

  it('drains queued messages sequentially and continues after failures', async () => {
    const calls: string[] = [];
    const generate = vi.fn().mockImplementation(async (content: string) => {
      calls.push(content);
      if (content === 'two') throw new Error('second failed');
      return { text: content, steps: [] };
    });
    const agent = createAgent({ generate } as Partial<Agent>);
    const { harness } = createHarness(createMemory(), new RecordingHarnessStorage(), undefined, agent);
    const events: HarnessEvent[] = [];
    harness.subscribe(event => {
      events.push(event);
    });
    const session = await harness.session({ threadId: 'thread-1', resourceId: 'resource-1' });
    events.length = 0;

    const first = session.queue({ content: 'one' });
    const second = session.queue({ content: 'two' });
    const third = session.queue({ content: 'three' });

    await expect(first).resolves.toMatchObject({ text: 'one' });
    await expect(second).rejects.toThrow('second failed');
    await expect(third).resolves.toMatchObject({ text: 'three' });

    expect(calls).toEqual(['one', 'two', 'three']);
    expect(events.map(event => event.type)).toEqual([
      'agent_start',
      'agent_end',
      'agent_start',
      'agent_end',
      'agent_start',
      'agent_end',
    ]);
    expect(
      events
        .filter(event => event.type === 'agent_end')
        .map(event => (event as Extract<HarnessEvent, { type: 'agent_end' }>).reason),
    ).toEqual(['complete', 'error', 'complete']);
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
    session.setMode({ id: 'plan', agentId: 'default', defaultModelId: 'test-plan-model' });

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
});
