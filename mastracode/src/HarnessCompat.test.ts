import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HarnessCompat } from './HarnessCompat.js';

const buildMode = { id: 'build', agentId: 'agent', defaultModelId: 'default-model', metadata: { name: 'Build' } };
const planMode = { id: 'plan', agentId: 'agent', defaultModelId: 'plan-model', metadata: { name: 'Plan' } };

function createSession(initialModelId = 'session-model', threadId = 'thread-id') {
  let modelId = initialModelId;
  let mode = buildMode;
  let state: Record<string, unknown> = { projectPath: '/session-repo' };
  const thread = {
    id: threadId,
    resourceId: 'resource-id',
    title: 'Thread',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {},
  };

  return {
    id: `sess-${threadId}`,
    threadId,
    resourceId: 'resource-id',
    getState: vi.fn(() => state),
    setState: vi.fn((updates: Record<string, unknown>) => {
      state = { ...state, ...updates };
      return Promise.resolve();
    }),
    getModelId: vi.fn(() => modelId),
    setModelId: vi.fn((next: string) => {
      modelId = next;
    }),
    getMode: vi.fn(() => mode),
    setMode: vi.fn(next => {
      mode = next;
    }),
    getThread: vi.fn(async () => thread),
    getMessages: vi.fn(async () => []),
    listSessionGrants: vi.fn(() => [
      { id: 'grant-category', category: 'read' },
      { id: 'grant-tool', toolName: 'write_file' },
    ]),
  };
}

function createHarness(session = createSession()) {
  const memory = {
    createThread: vi.fn(async ({ threadId, resourceId, title, metadata }) => ({
      id: threadId,
      resourceId,
      title,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      metadata,
    })),
    listThreads: vi.fn(async () => ({ threads: [] })),
    getThreadById: vi.fn(),
    saveThread: vi.fn(),
    saveMessages: vi.fn(async ({ messages }) => ({ messages })),
    recall: vi.fn(async () => []),
  };
  const harnessV1 = {
    init: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
    listModes: vi.fn(() => [buildMode, planMode]),
    getMode: vi.fn((modeId: string) => (modeId === 'plan' ? planMode : buildMode)),
    session: vi.fn(async () => session),
    listSessions: vi.fn(async () => []),
    cloneSession: vi.fn(),
  };
  const mastra = { getAgentById: vi.fn(() => ({ id: 'agent' })) };
  const harness = new HarnessCompat(
    {
      resourceId: 'resource-id',
      mastra: mastra as never,
      memory: memory as never,
      modes: [buildMode, planMode],
      defaultModeId: 'build',
      initialState: {
        projectPath: '/repo',
        subagentModelIds: { worker: 'worker-model' },
        observerModelId: 'observer-model',
        reflectorModelId: 'reflector-model',
        observationThreshold: 123,
        reflectionThreshold: 456,
      },
    },
    harnessV1 as never,
  );

  return { harness, harnessV1, memory, mastra, session };
}

describe('HarnessCompat standalone V1 adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes model and mode from the active V1 session', async () => {
    const { harness, harnessV1 } = createHarness();

    await harness.switchThread({ threadId: 'thread-id' });

    expect(harness.getState()).toMatchObject({
      projectPath: '/session-repo',
      currentModelId: 'session-model',
      modeId: 'build',
    });
    expect(harnessV1.session).toHaveBeenCalledWith({ threadId: 'thread-id', resourceId: 'resource-id' });
  });

  it('preserves the current model when switching threads', async () => {
    const firstSession = createSession('selected-model', 'first-thread');
    const secondSession = createSession('stored-thread-model', 'second-thread');
    const { harness, harnessV1 } = createHarness(firstSession);
    harnessV1.session.mockResolvedValueOnce(firstSession).mockResolvedValueOnce(secondSession);

    await harness.switchThread({ threadId: 'first-thread' });
    await harness.switchThread({ threadId: 'second-thread' });

    expect(secondSession.setModelId).toHaveBeenCalledWith('selected-model');
    expect(harness.getState()).toMatchObject({ currentModelId: 'selected-model' });
  });

  it('routes session-derived setState fields to the V1 session and stores adapter state locally', async () => {
    const { harness, session } = createHarness();
    await harness.switchThread({ threadId: 'thread-id' });

    await harness.setState({
      currentModelId: 'new-session-model',
      modeId: 'plan',
      projectPath: '/new-repo',
    } as never);

    expect(session.setModelId).toHaveBeenCalledWith('new-session-model');
    expect(session.setMode).toHaveBeenCalledWith(planMode);
    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/new-repo' });
    expect(harness.getState()).toMatchObject({
      projectPath: '/new-repo',
      currentModelId: 'new-session-model',
      modeId: 'plan',
    });
  });

  it('keeps per-agent subagent model overrides in adapter state', async () => {
    const { harness } = createHarness();

    expect(harness.getSubagentModelId({ agentType: 'worker' })).toBe('worker-model');
    expect(harness.getSubagentModelId()).toBeNull();

    await harness.setSubagentModelId({ modelId: 'default-subagent-model' });

    expect(harness.getSubagentModelId()).toBe('default-subagent-model');
  });

  it('clones threads through Harness V1 without a legacy harness instance', async () => {
    const sourceSession = createSession('selected-model', 'source-thread');
    const clonedSession = createSession('selected-model', 'cloned-thread');
    const { harness, harnessV1 } = createHarness(sourceSession);
    harnessV1.session.mockResolvedValue(sourceSession);
    harnessV1.cloneSession.mockResolvedValue(clonedSession);

    await harness.switchThread({ threadId: 'source-thread' });
    const thread = await harness.cloneThread({ title: 'Clone' });

    expect(harnessV1.cloneSession).toHaveBeenCalledWith(sourceSession, { title: 'Clone' });
    expect(thread.id).toBe('cloned-thread');
    expect(harness.getCurrentThreadId()).toBe('cloned-thread');
  });

  it('exposes current model and OM state helpers', async () => {
    const { harness } = createHarness();

    expect(harness.getCurrentModelId()).toBe('default-model');
    expect(harness.getFullModelId()).toBe('default-model');
    expect(harness.hasModelSelected()).toBe(true);
    expect(harness.getObserverModelId()).toBe('observer-model');
    expect(harness.getReflectorModelId()).toBe('reflector-model');
    expect(harness.getObservationThreshold()).toBe(123);
    expect(harness.getReflectionThreshold()).toBe(456);

    await harness.switchObserverModel('new-observer');
    await harness.switchReflectorModel('new-reflector');

    expect(harness.getObserverModelId()).toBe('new-observer');
    expect(harness.getReflectorModelId()).toBe('new-reflector');
  });

  it('sets and returns permission rules and session grants', async () => {
    const { harness } = createHarness();
    await harness.switchThread({ threadId: 'thread-id' });

    await harness.setPermissionForCategory('read', 'allow');
    await harness.setPermissionForTool('write_file', 'deny');

    expect(harness.getPermissionRules()).toEqual({
      categories: { read: 'allow' },
      tools: { write_file: 'deny' },
    });
    expect(harness.getSessionGrants()).toEqual({ categories: ['read'], tools: ['write_file'] });
  });

  it('selects, switches, and renames threads through V1 storage', async () => {
    const { harness, memory, harnessV1 } = createHarness();
    const thread = {
      id: 'memory-thread',
      resourceId: 'resource-id',
      title: 'Memory Thread',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      metadata: {},
    };
    memory.listThreads.mockResolvedValue({ threads: [thread] } as never);
    memory.getThreadById.mockResolvedValue(thread as never);

    const selected = await harness.selectOrCreateThread();
    expect(selected.id).toBe('memory-thread');
    expect(harnessV1.session).toHaveBeenCalledWith({ threadId: 'memory-thread', resourceId: 'resource-id' });

    await harness.switchCurrentThread('memory-thread');
    expect(harness.getCurrentThreadId()).toBe('memory-thread');

    await harness.renameThread({ title: 'Renamed' });
    expect(memory.saveThread).toHaveBeenCalledWith({
      thread: { ...thread, title: 'Renamed', updatedAt: expect.any(Date) },
    });
  });

  it('persists system reminders and returns first user messages', async () => {
    const session = createSession('session-model', 'thread-id');
    session.getMessages.mockResolvedValue([
      {
        id: 'user-message',
        role: 'user',
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
        content: { content: 'hello', parts: [] },
      },
    ] as never);
    const { harness, memory } = createHarness(session);
    await harness.switchThread({ threadId: 'thread-id' });

    const reminder = await harness.saveSystemReminderMessage({ message: 'remember this', reminderType: 'note' });
    expect(reminder?.content[0]).toMatchObject({ type: 'system_reminder', message: 'remember this' });
    expect(memory.saveMessages).toHaveBeenCalled();

    const firstMessages = await harness.getFirstUserMessagesForThreads({ threadIds: ['thread-id'] });
    expect(firstMessages.get('thread-id')?.content[0]).toMatchObject({ type: 'text', text: 'hello' });
  });
});
