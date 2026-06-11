import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HarnessCompat } from './HarnessCompat.js';

const buildMode = { id: 'build', defaultModelId: 'default-model', metadata: { name: 'Build' } };
const planMode = { id: 'plan', defaultModelId: 'plan-model', metadata: { name: 'Plan' } };

async function* streamChunks(chunks: unknown[]) {
  for (const chunk of chunks) yield chunk;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(next => {
    resolve = next;
  });
  return { promise, resolve };
}

function toStream(chunks: unknown[] | AsyncIterable<unknown>): AsyncIterable<unknown> {
  return Symbol.asyncIterator in Object(chunks) ? (chunks as AsyncIterable<unknown>) : streamChunks(chunks as unknown[]);
}

function createSession(
  initialModelId = 'session-model',
  threadId = 'thread-id',
  chunks: unknown[] | AsyncIterable<unknown> = [],
) {
  let modelId = initialModelId;
  let mode = buildMode;
  let activeRunId: string | null = null;
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
    getCurrentRunId: vi.fn(() => activeRunId),
    getThread: vi.fn(async () => thread),
    getMessages: vi.fn(async () => []),
    subscribeToThread: vi.fn(async () => ({ stream: toStream(chunks), unsubscribe: vi.fn(async () => {}) })),
    sendMessage: vi.fn(async ({ messages }) => ({ accepted: true, runId: 'run-1', signal: messages })),
    queueMessage: vi.fn(async () => {
      activeRunId = 'run-queued';
      return { accepted: true, queued: true };
    }),
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
  const defaultAgent = { id: 'agent' } as unknown as import('@mastra/core/agent').Agent;
  const harness = new HarnessCompat(
    {
      resourceId: 'resource-id',
      mastra: mastra as never,
      memory: memory as never,
      modes: [buildMode, planMode],
      defaultModeId: 'build',
      defaultAgent,
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
    expect(harnessV1.session).toHaveBeenCalledWith({
      threadId: 'thread-id',
      resourceId: 'resource-id',
      modeId: 'build',
      modelId: undefined,
    });
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

  it('preserves the selected mode and model when creating a new thread', async () => {
    const currentSession = createSession('current-model', 'current-thread');
    const newThreadSession = createSession('fallback-model', 'new-thread');
    const { harness, harnessV1 } = createHarness(currentSession);
    harnessV1.session.mockResolvedValueOnce(currentSession).mockImplementationOnce(async (...args: unknown[]) => {
      const opts = args[0] as { modeId?: string; modelId?: string };
      if (opts.modeId === 'plan') newThreadSession.setMode(planMode);
      if (opts.modelId) newThreadSession.setModelId(opts.modelId);
      return newThreadSession;
    });

    await harness.switchThread({ threadId: 'current-thread' });
    await harness.setState({ modeId: 'plan', currentModelId: 'selected-plan-model' } as never);
    const events: Array<{ type: string }> = [];
    harness.subscribe(event => {
      events.push({ type: event.type });
    });

    const thread = await harness.createThread();

    expect(harnessV1.session).toHaveBeenLastCalledWith({
      threadId: thread.id,
      resourceId: 'resource-id',
      modeId: 'plan',
      modelId: 'selected-plan-model',
    });
    expect(thread.metadata).toMatchObject({ modeId: 'plan', modelId: 'selected-plan-model' });
    expect(harness.getState()).toMatchObject({ modeId: 'plan', currentModelId: 'selected-plan-model' });
    expect(events.map(event => event.type)).toEqual(['thread_created']);
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

  it('returns a legacy signal handle with accepted delivery promise', async () => {
    const session = createSession('session-model', 'thread-id', [{ type: 'finish' }]);
    const { harness } = createHarness(session);
    await harness.switchThread({ threadId: 'thread-id' });

    const signal = harness.sendSignal({ id: 'signal-1', type: 'user-message', contents: 'hello' });

    expect(signal).toMatchObject({ id: 'signal-1', type: 'user' });
    expect(signal.accepted.catch).toEqual(expect.any(Function));
    await expect(signal.accepted).resolves.toEqual({ accepted: true, runId: 'run-1' });
    expect(session.sendMessage).toHaveBeenCalledWith({
      messages: { id: 'signal-1', type: 'user-message', contents: 'hello' },
    });
    expect(session.queueMessage).not.toHaveBeenCalled();
  });

  it('normalizes legacy content signals and preserves delivery options', async () => {
    const session = createSession('session-model', 'thread-id', [{ type: 'finish' }]);
    const { harness } = createHarness(session);
    await harness.switchThread({ threadId: 'thread-id' });

    const signal = harness.sendSignal({
      id: 'signal-1',
      content: [
        { type: 'text', text: 'hello' },
        { type: 'file', data: 'data:image/png;base64,abc', mediaType: 'image/png' },
      ],
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    });

    await signal.accepted;

    expect(session.sendMessage).toHaveBeenCalledWith({
      messages: {
        id: 'signal-1',
        type: 'user-message',
        contents: [
          { type: 'text', text: 'hello' },
          { type: 'file', data: 'data:image/png;base64,abc', mediaType: 'image/png' },
        ],
      },
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    });
    expect(session.queueMessage).not.toHaveBeenCalled();
  });

  it('does not open a duplicate stream subscription for active signal delivery', async () => {
    let finish!: () => void;
    const finishPromise = new Promise<void>(resolve => {
      finish = resolve;
    });
    async function* activeStream() {
      await finishPromise;
      yield { type: 'finish' };
    }
    const session = createSession('session-model', 'thread-id', activeStream());
    const { harness } = createHarness(session);
    await harness.switchThread({ threadId: 'thread-id' });

    const running = harness.sendMessage('already running');
    await flush();
    expect(harness.isCurrentThreadStreamActive()).toBe(true);

    const signal = harness.sendSignal({
      id: 'signal-active',
      content: 'while active',
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    });

    await signal.accepted;
    expect(session.subscribeToThread).toHaveBeenCalledTimes(1);
    expect(session.sendMessage).toHaveBeenCalledWith({
      messages: { id: 'signal-active', type: 'user-message', contents: 'while active' },
      ifActive: { attributes: { delivery: 'while-active' } },
      ifIdle: { attributes: { delivery: 'message' } },
    });

    finish();
    await running;
  });

  it('does not treat stale display running state as active signal delivery', async () => {
    const firstRun = deferred();
    // Persistent-subscription model: the harness subscribes to the thread once
    // and splits the single stream into runs delimited by terminal chunks. The
    // first run blocks until released, the signal's run terminates immediately.
    async function* persistentStream() {
      await firstRun.promise;
      yield { type: 'finish' };
      yield { type: 'finish' };
    }
    const session = createSession('session-model', 'thread-id', []);
    session.queueMessage.mockResolvedValueOnce({ accepted: true, queued: true });
    session.subscribeToThread.mockResolvedValueOnce({
      stream: persistentStream(),
      unsubscribe: vi.fn(async () => {}),
    });
    const { harness } = createHarness(session);
    await harness.switchThread({ threadId: 'thread-id' });

    const running = harness.sendMessage('stale running');
    await flush();
    expect(harness.isRunning()).toBe(true);
    expect(harness.isCurrentThreadStreamActive()).toBe(false);

    // Stale display state must still route the idle signal through sendMessage
    // (not queueMessage) since the stream is not actually active.
    const signal = harness.sendSignal({ id: 'signal-idle', content: 'idle despite display state' });
    await flush();

    expect(session.sendMessage).toHaveBeenCalledWith({
      messages: { id: 'signal-idle', type: 'user-message', contents: 'idle despite display state' },
    });

    // Release the shared persistent stream so both the message run and the
    // signal run reach their terminal chunks.
    firstRun.resolve();
    await signal.accepted;
    await running;

    // A single persistent subscription is reused across the message and signal.
    expect(session.subscribeToThread).toHaveBeenCalledTimes(1);
  });

  it('streams payload-shaped idle signal responses through the compat event bridge', async () => {
    const session = createSession('session-model', 'thread-id', [
      { type: 'tool-call', payload: { toolCallId: 'tool-1', toolName: 'read_file', args: { path: 'README.md' } } },
      { type: 'tool-result', payload: { toolCallId: 'tool-1', toolName: 'read_file', result: 'contents', isError: false } },
      { type: 'text-delta', payload: { id: 'text-1', text: 'hello' } },
      { type: 'finish' },
    ]);
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    const signal = harness.sendSignal({ id: 'signal-idle', content: 'hello' });
    await signal.accepted;
    await flush();

    const lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual([
      'agent_start',
      'tool_start',
      'message_update',
      'tool_end',
      'message_update',
      'message_update',
      'message_end',
      'agent_end',
    ]);
    expect(lifecycleEvents[1]).toMatchObject({
      type: 'tool_start',
      toolCallId: 'tool-1',
      toolName: 'read_file',
      args: { path: 'README.md' },
    });
    expect(lifecycleEvents[3]).toMatchObject({
      type: 'tool_end',
      toolCallId: 'tool-1',
      result: 'contents',
      isError: false,
    });
    expect(lifecycleEvents[6]?.message).toMatchObject({
      content: [
        { type: 'tool_call', id: 'tool-1', name: 'read_file', args: { path: 'README.md' } },
        { type: 'tool_result', id: 'tool-1', name: 'read_file', result: 'contents', isError: false },
        { type: 'text', text: 'hello' },
      ],
    });
    expect(lifecycleEvents[7]).toMatchObject({ type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: false, currentMessage: null });
  });

  it('streams real V1 data-part chunks through the compat event bridge', async () => {
    const session = createSession('session-model', 'thread-id', [
      { type: 'text-start', id: 'text-1' },
      { type: 'text-delta', id: 'text-1', delta: 'Hello' },
      { type: 'tool-call-input-streaming-start', toolCallId: 'tool-1', toolName: 'run_shell' },
      { type: 'tool-call-delta', toolCallId: 'tool-1', toolName: 'run_shell', argsTextDelta: '{"cmd":"echo hi"}' },
      { type: 'tool-call-input-streaming-end', toolCallId: 'tool-1', toolName: 'run_shell' },
      { type: 'tool-call', toolCallId: 'tool-1', toolName: 'run_shell', args: { cmd: 'echo hi' } },
      { type: 'data-sandbox-stdout', data: { toolCallId: 'tool-1', output: 'hi\n' } },
      { type: 'tool-result', toolCallId: 'tool-1', toolName: 'run_shell', result: 'hi\n' },
      { type: 'text-delta', id: 'text-1', delta: ' there' },
      { type: 'finish' },
    ]);
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    await harness.sendSignal({ id: 'signal-v1-chunks', content: 'hello' }).accepted;

    const lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual([
      'agent_start',
      'message_start',
      'message_update',
      'tool_input_start',
      'tool_input_delta',
      'tool_input_end',
      'tool_start',
      'message_update',
      'shell_output',
      'tool_end',
      'message_update',
      'message_update',
      'message_end',
      'agent_end',
    ]);
    expect(lifecycleEvents[4]).toMatchObject({
      type: 'tool_input_delta',
      toolCallId: 'tool-1',
      argsTextDelta: '{"cmd":"echo hi"}',
    });
    expect(lifecycleEvents[8]).toMatchObject({
      type: 'shell_output',
      toolCallId: 'tool-1',
      output: 'hi\n',
      stream: 'stdout',
    });
    expect(lifecycleEvents[12]?.message).toMatchObject({
      content: [
        { type: 'text', text: 'Hello there' },
        { type: 'tool_call', id: 'tool-1', name: 'run_shell', args: { cmd: 'echo hi' } },
        { type: 'tool_result', id: 'tool-1', name: 'run_shell', result: 'hi\n', isError: false },
      ],
    });
  });

  it('drives delayed idle signal streams before resolving delivery', async () => {
    const firstDelta = deferred();
    const finish = deferred();
    async function* delayedStream() {
      await firstDelta.promise;
      yield { type: 'text-delta', payload: { id: 'text-1', text: 'hello' } };
      await finish.promise;
      yield { type: 'text-delta', payload: { id: 'text-1', text: ' world' } };
      yield { type: 'finish' };
    }
    const session = createSession('session-model', 'thread-id', delayedStream());
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    let acceptedResolved = false;
    const signal = harness.sendSignal({ id: 'signal-delayed', content: 'hello' });
    void signal.accepted.then(() => {
      acceptedResolved = true;
    });
    await flush();

    expect(acceptedResolved).toBe(false);
    expect(events.filter(event => event.type !== 'display_state_changed').map(event => event.type)).toEqual(['agent_start']);
    expect(harness.getDisplayState()).toMatchObject({ isRunning: true });

    firstDelta.resolve();
    await flush();
    await flush();

    let lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual(['agent_start', 'message_start']);
    expect(lifecycleEvents[1]?.message).toMatchObject({ content: [{ type: 'text', text: 'hello' }] });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: true, currentMessage: expect.any(Object) });
    expect(acceptedResolved).toBe(false);

    finish.resolve();
    await expect(signal.accepted).resolves.toEqual({ accepted: true, runId: 'run-1' });

    lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual([
      'agent_start',
      'message_start',
      'message_update',
      'message_end',
      'agent_end',
    ]);
    expect(lifecycleEvents[3]?.message).toMatchObject({ content: [{ type: 'text', text: 'hello world' }] });
    expect(lifecycleEvents[4]).toMatchObject({ type: 'agent_end', reason: 'complete' });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: false, currentMessage: null });
  });

  it('rejects idle signal delivery when the owned stream fails', async () => {
    const session = createSession('session-model', 'thread-id', [{ type: 'error', error: { message: 'model failed' } }]);
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    const signal = harness.sendSignal({ id: 'signal-error', content: 'hello' });

    await expect(signal.accepted).rejects.toThrow('model failed');

    const lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual(['agent_start', 'error', 'agent_end']);
    expect(lifecycleEvents[1]?.error).toBeInstanceOf(Error);
    expect((lifecycleEvents[1]?.error as Error).message).toBe('model failed');
    expect(lifecycleEvents[2]).toMatchObject({ type: 'agent_end', reason: 'error' });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: false, currentMessage: null });
  });

  it('emits error terminal chunks as failed agent runs', async () => {
    const session = createSession('session-model', 'thread-id', [{ type: 'error', error: { message: 'model failed' } }]);
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    await harness.sendMessage('hello');

    const lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(session.queueMessage).toHaveBeenCalledWith({ messages: 'hello' });
    expect(lifecycleEvents.map(event => event.type)).toEqual(['agent_start', 'error', 'agent_end']);
    expect(lifecycleEvents[1]?.error).toBeInstanceOf(Error);
    expect((lifecycleEvents[1]?.error as Error).message).toBe('model failed');
    expect(lifecycleEvents[2]).toMatchObject({ type: 'agent_end', reason: 'error' });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: false, currentMessage: null });
  });

  it('emits abort terminal chunks as aborted agent runs', async () => {
    const session = createSession('session-model', 'thread-id', [{ type: 'abort' }]);
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    await harness.sendMessage('hello');

    const lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual(['agent_start', 'agent_end']);
    expect(lifecycleEvents[1]).toMatchObject({ type: 'agent_end', reason: 'aborted' });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: false, currentMessage: null });
  });

  it('emits tool suspension terminal chunks as suspended agent runs', async () => {
    const session = createSession('session-model', 'thread-id', [
      {
        type: 'tool-call-suspended',
        payload: {
          toolCallId: 'tool-1',
          toolName: 'confirm',
          args: { action: 'deploy' },
          suspendPayload: { question: 'Proceed?' },
          resumeSchema: '{"type":"object"}',
        },
      },
    ]);
    const { harness } = createHarness(session);
    const events: Array<Record<string, unknown>> = [];
    harness.subscribe(event => {
      events.push(event as unknown as Record<string, unknown>);
    });
    await harness.switchThread({ threadId: 'thread-id' });
    events.length = 0;

    await harness.sendMessage('hello');

    const lifecycleEvents = events.filter(event => event.type !== 'display_state_changed');
    expect(lifecycleEvents.map(event => event.type)).toEqual(['agent_start', 'tool_suspended', 'agent_end']);
    expect(lifecycleEvents[1]).toMatchObject({
      type: 'tool_suspended',
      toolCallId: 'tool-1',
      toolName: 'confirm',
      args: { action: 'deploy' },
      suspendPayload: { question: 'Proceed?' },
      resumeSchema: '{"type":"object"}',
    });
    expect(lifecycleEvents[2]).toMatchObject({ type: 'agent_end', reason: 'suspended' });
    expect(harness.getDisplayState()).toMatchObject({ isRunning: false, currentMessage: null });
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
    expect(harnessV1.session).toHaveBeenCalledWith({
      threadId: 'memory-thread',
      resourceId: 'resource-id',
      modeId: 'build',
      modelId: undefined,
    });

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
