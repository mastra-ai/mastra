import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../../../background-tasks/create', () => ({
  createBackgroundTask: vi.fn(),
}));

vi.mock('../../../../background-tasks/resolve-config', () => ({
  resolveBackgroundConfig: vi.fn(),
}));

vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const { createBackgroundTask } = await import('../../../../background-tasks/create');
const { resolveBackgroundConfig } = await import('../../../../background-tasks/resolve-config');
const { emitChunkEvent } = await import('../../stream-adapter');
const { resolveTool: _resolveTool } = await import('../../utils/resolve-runtime');

const RUN_ID = 'run-bg-1';
const AGENT_ID = 'agent-1';
const TOOL_NAME = 'research';
const TOOL_CALL_ID = 'call-1';

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

function baseInput() {
  return {
    toolCallId: TOOL_CALL_ID,
    toolName: TOOL_NAME,
    args: { topic: 'quantum' },
  };
}

function makeInitData(overrides: Record<string, any> = {}) {
  return {
    runId: RUN_ID,
    agentId: AGENT_ID,
    options: { requireToolApproval: false },
    state: {
      threadId: 'thread-1',
      resourceId: 'user-1',
      memoryConfig: undefined,
      threadExists: false,
    },
    ...overrides,
  };
}

function makeMessageList() {
  return {
    updateToolInvocation: vi.fn().mockReturnValue(true),
    add: vi.fn(),
  };
}

function makeSaveQueueManager() {
  return { flushMessages: vi.fn().mockResolvedValue(undefined) };
}

function setupRegistry(overrides: Record<string, any> = {}) {
  const messageList = makeMessageList();
  const saveQueueManager = makeSaveQueueManager();
  const bgManager = { config: {}, listTasks: vi.fn() };

  const entry = {
    tools: {
      [TOOL_NAME]: {
        execute: vi.fn().mockResolvedValue({ summary: 'done' }),
        backgroundConfig: { enabled: true },
      },
    },
    model: {} as any,
    backgroundTaskManager: bgManager,
    backgroundTasksConfig: { tools: { [TOOL_NAME]: true } },
    messageList,
    saveQueueManager,
    ...overrides,
  };

  globalRunRegistry.set(RUN_ID, entry as any);
  return { messageList, saveQueueManager, bgManager, entry };
}

function executeStep(pubsub: any, initData: any, input?: any) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: input ?? baseInput(),
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    resumeData: undefined,
    requestContext: new Map(),
    getInitData: () => initData,
    [PUBSUB_SYMBOL]: pubsub,
  });
}

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call background task dispatch', () => {
  it('dispatches a background task and returns a placeholder result', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 2,
    } as any);

    const mockTask = { id: 'task-abc' };
    vi.mocked(createBackgroundTask).mockReturnValue({
      dispatch: vi.fn().mockResolvedValue({ task: mockTask, fallbackToSync: false }),
      task: mockTask,
      cancel: vi.fn(),
      waitForCompletion: vi.fn(),
    } as any);

    const result = await executeStep(pubsub, initData);

    expect(result.result).toContain('Background task started');
    expect(result.result).toContain('task-abc');
    expect(result.result).toContain(TOOL_NAME);
  });

  it('falls back to sync execution when fallbackToSync is true', async () => {
    const pubsub = mockPubsub();
    const { entry: _entry } = setupRegistry();
    const initData = makeInitData();

    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockReturnValue({
      dispatch: vi.fn().mockResolvedValue({ task: { id: 't1' }, fallbackToSync: true }),
      task: { id: 't1' },
      cancel: vi.fn(),
      waitForCompletion: vi.fn(),
    } as any);

    const result = await executeStep(pubsub, initData);

    // Should have fallen through to synchronous execution
    expect(result.result).toEqual({ summary: 'done' });
  });

  it('falls back to sync execution when dispatch throws', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockReturnValue({
      dispatch: vi.fn().mockRejectedValue(new Error('dispatch boom')),
      task: { id: 't1' } as any,
      cancel: vi.fn(),
      waitForCompletion: vi.fn(),
    } as any);

    const result = await executeStep(pubsub, initData);

    // Fell through to sync, tool executed normally
    expect(result.result).toEqual({ summary: 'done' });
  });

  it('emits background-task-started chunk via PubSub after successful dispatch', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockReturnValue({
      dispatch: vi.fn().mockResolvedValue({ task: { id: 'task-x' }, fallbackToSync: false }),
      task: { id: 'task-x' },
      cancel: vi.fn(),
      waitForCompletion: vi.fn(),
    } as any);

    await executeStep(pubsub, initData);

    expect(vi.mocked(emitChunkEvent)).toHaveBeenCalledWith(
      pubsub,
      RUN_ID,
      expect.objectContaining({
        type: 'background-task-started',
        payload: expect.objectContaining({
          taskId: 'task-x',
          toolName: TOOL_NAME,
          toolCallId: TOOL_CALL_ID,
        }),
      }),
    );
  });

  it('onResult hook injects real result into MessageList and flushes to memory', async () => {
    const pubsub = mockPubsub();
    const { messageList, saveQueueManager } = setupRegistry();
    const initData = makeInitData();

    let capturedOnResult: any;
    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockImplementation((_mgr: any, opts: any) => {
      capturedOnResult = opts.context.onResult;
      return {
        dispatch: vi.fn().mockResolvedValue({ task: { id: 't-r' }, fallbackToSync: false }),
        task: { id: 't-r' },
        cancel: vi.fn(),
        waitForCompletion: vi.fn(),
      } as any;
    });

    await executeStep(pubsub, initData);

    // Simulate bg task completion
    await capturedOnResult({
      runId: RUN_ID,
      taskId: 't-r',
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      agentId: AGENT_ID,
      result: { summary: 'real result' },
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(messageList.updateToolInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({
          state: 'result',
          toolCallId: TOOL_CALL_ID,
          result: { summary: 'real result' },
        }),
      }),
      expect.objectContaining({
        backgroundTasks: expect.objectContaining({
          [TOOL_CALL_ID]: expect.objectContaining({ taskId: 't-r' }),
        }),
      }),
    );

    expect(saveQueueManager.flushMessages).toHaveBeenCalledWith(messageList, 'thread-1', undefined);
  });

  it('onExecution hook updates tool invocation metadata with startedAt/taskId', async () => {
    const pubsub = mockPubsub();
    const { messageList } = setupRegistry();
    const initData = makeInitData();

    let capturedOnExecution: any;
    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockImplementation((_mgr: any, opts: any) => {
      capturedOnExecution = opts.context.onExecution;
      return {
        dispatch: vi.fn().mockResolvedValue({ task: { id: 't-e' }, fallbackToSync: false }),
        task: { id: 't-e' },
        cancel: vi.fn(),
        waitForCompletion: vi.fn(),
      } as any;
    });

    await executeStep(pubsub, initData);

    const startedAt = new Date();
    await capturedOnExecution({
      runId: RUN_ID,
      taskId: 't-e',
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      agentId: AGENT_ID,
      startedAt,
    });

    expect(messageList.updateToolInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({
          state: 'call',
          toolCallId: TOOL_CALL_ID,
        }),
      }),
      expect.objectContaining({
        backgroundTasks: expect.objectContaining({
          [TOOL_CALL_ID]: expect.objectContaining({
            startedAt,
            taskId: 't-e',
          }),
        }),
      }),
    );
  });

  it('onChunk emits tool-call + tool-result chunks via PubSub on completion', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    let capturedOnChunk: any;
    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockImplementation((_mgr: any, opts: any) => {
      capturedOnChunk = opts.context.onChunk;
      return {
        dispatch: vi.fn().mockResolvedValue({ task: { id: 't-c' }, fallbackToSync: false }),
        task: { id: 't-c' },
        cancel: vi.fn(),
        waitForCompletion: vi.fn(),
      } as any;
    });

    await executeStep(pubsub, initData);
    vi.mocked(emitChunkEvent).mockClear();

    // Simulate bg-task-completed chunk from a different runId (continuation scenario)
    capturedOnChunk({
      type: 'background-task-completed',
      payload: {
        runId: 'run-bg-2',
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        result: { summary: 'done' },
      },
    });

    const calls = vi.mocked(emitChunkEvent).mock.calls;
    const types = calls.map(c => c[2].type);
    expect(types).toContain('tool-call');
    expect(types).toContain('tool-result');
  });

  it('onChunk emits tool-call + tool-error chunks via PubSub on failure', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    let capturedOnChunk: any;
    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockImplementation((_mgr: any, opts: any) => {
      capturedOnChunk = opts.context.onChunk;
      return {
        dispatch: vi.fn().mockResolvedValue({ task: { id: 't-f' }, fallbackToSync: false }),
        task: { id: 't-f' },
        cancel: vi.fn(),
        waitForCompletion: vi.fn(),
      } as any;
    });

    await executeStep(pubsub, initData);
    vi.mocked(emitChunkEvent).mockClear();

    capturedOnChunk({
      type: 'background-task-failed',
      payload: {
        runId: 'run-bg-3',
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        error: { message: 'boom' },
      },
    });

    const calls = vi.mocked(emitChunkEvent).mock.calls;
    const types = calls.map(c => c[2].type);
    expect(types).toContain('tool-call');
    expect(types).toContain('tool-error');
  });

  it('passes threadId and resourceId in the task payload', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();

    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 0,
    } as any);

    vi.mocked(createBackgroundTask).mockReturnValue({
      dispatch: vi.fn().mockResolvedValue({ task: { id: 't-p' }, fallbackToSync: false }),
      task: { id: 't-p' },
      cancel: vi.fn(),
      waitForCompletion: vi.fn(),
    } as any);

    await executeStep(pubsub, initData);

    const callArgs = vi.mocked(createBackgroundTask).mock.calls[0]![1]!;
    expect(callArgs.threadId).toBe('thread-1');
    expect(callArgs.resourceId).toBe('user-1');
  });
});
