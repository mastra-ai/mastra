import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { MessageList } from '../../../message-list';
import { createToolCallIdentityDigest } from '../../../tool-call-identity';
import { ON_BEFORE_TOOL_EXECUTION_KEY, TOOL_PERMISSION_DENIED_ERROR_NAME } from '../../../tool-permission-prefilter';
import { globalRunRegistry } from '../../run-registry';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../../../workflows', () => ({
  createStep: (config: unknown) => config,
}));

vi.mock('../../../../background-tasks/create', () => ({
  createBackgroundTask: vi.fn(),
}));

vi.mock('../../../../background-tasks/resolve-config', () => ({
  resolveBackgroundConfig: vi.fn(),
}));

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolApprovalRequirement: vi.fn().mockResolvedValue({ required: false, reasons: [] }),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
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
const RUNTIME_BINDING_ID = 'binding-bg-1';
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
    runtimeBindingId: RUNTIME_BINDING_ID,
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
  const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
  vi.spyOn(messageList, 'updateToolInvocation');
  vi.spyOn(messageList, 'updateMessageMetadataByToolCallId');
  return messageList;
}

function makeSaveQueueManager() {
  return { flushMessages: vi.fn().mockResolvedValue(undefined) };
}

function setupRegistry(overrides: Record<string, any> = {}) {
  const messageList = makeMessageList();
  const saveQueueManager = makeSaveQueueManager();
  const bgManager = { config: {}, listTasks: vi.fn() };

  const entry = {
    runtimeBindingId: RUNTIME_BINDING_ID,
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

function executeStep(pubsub: any, initData: any, input?: any, resumeData?: unknown, suspendData?: unknown) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: input ?? baseInput(),
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    resumeData,
    suspendData,
    requestContext: new Map(),
    getInitData: () => initData,
    [PUBSUB_SYMBOL]: pubsub,
  });
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) {
    globalRunRegistry.delete(RUN_ID);
  }
  vi.clearAllMocks();
});

describe('durable tool-call background task dispatch', () => {
  it('fails closed when a built-in durable run loses its runtime registry entry', async () => {
    const pubsub = mockPubsub();

    const initData = makeInitData({ runtimeResolution: 'registry-required' });
    await expect(executeStep(pubsub, initData)).rejects.toMatchObject({
      id: 'DURABLE_AGENT_RUNTIME_REGISTRY_MISSING',
    });
    expect(globalRunRegistry.has(RUN_ID)).toBe(false);

    // A retry must fail identically rather than inheriting a placeholder seeded
    // by abort-listener bootstrap and degrading to ToolNotFoundError.
    await expect(executeStep(pubsub, initData)).rejects.toMatchObject({
      id: 'DURABLE_AGENT_RUNTIME_REGISTRY_MISSING',
    });
    expect(globalRunRegistry.has(RUN_ID)).toBe(false);

    globalRunRegistry.set(RUN_ID, {
      isPlaceholder: true,
      runtimeBindingId: RUNTIME_BINDING_ID,
      tools: {},
      model: undefined as any,
    } as any);
    await expect(executeStep(pubsub, initData)).rejects.toMatchObject({
      id: 'DURABLE_AGENT_RUNTIME_REGISTRY_MISSING',
    });
    expect(_resolveTool).not.toHaveBeenCalled();
  });

  it('does not fall back to a current Mastra tool for a registry-required run', async () => {
    const pubsub = mockPubsub();
    setupRegistry({ tools: {} });

    const result = await executeStep(pubsub, makeInitData({ runtimeResolution: 'registry-required' }));
    expect(result.error).toMatchObject({ name: 'ToolNotFoundError' });
    expect(_resolveTool).not.toHaveBeenCalled();
  });

  it('fails closed when a replacement run loses its registry before tool dispatch', async () => {
    await expect(
      executeStep(
        mockPubsub(),
        makeInitData({ options: { requireToolApproval: false, toolSurfaceFence: [TOOL_NAME] } }),
      ),
    ).rejects.toThrow(/Cannot reconstruct replacement tool implementations/);
  });

  it('fails closed when a replacement registry loses an allowed implementation before dispatch', async () => {
    setupRegistry({ tools: {} });
    const backingExecute = vi.fn().mockResolvedValue('backing');
    vi.mocked(_resolveTool).mockReturnValue({ execute: backingExecute } as any);

    await expect(
      executeStep(
        mockPubsub(),
        makeInitData({ options: { requireToolApproval: false, toolSurfaceFence: [TOOL_NAME] } }),
      ),
    ).rejects.toThrow(/has no own concrete implementation/);
    expect(backingExecute).not.toHaveBeenCalled();
  });

  it('does not dispatch an out-of-fence registry tool or a same-name backing tool', async () => {
    const allowedExecute = vi.fn().mockResolvedValue('allowed');
    const hiddenExecute = vi.fn().mockResolvedValue('hidden');
    const backingExecute = vi.fn().mockResolvedValue('backing');
    setupRegistry({
      tools: {
        allowedTool: { execute: allowedExecute },
        hiddenTool: { execute: hiddenExecute },
      },
    });
    vi.mocked(_resolveTool).mockReturnValue({ execute: backingExecute } as any);

    const result = await executeStep(
      mockPubsub(),
      makeInitData({ options: { requireToolApproval: false, toolSurfaceFence: ['allowedTool'] } }),
      { ...baseInput(), toolName: 'hiddenTool' },
    );

    expect(result.error).toEqual(expect.objectContaining({ name: 'ToolNotFoundError' }));
    expect(result.error.message).toContain('Available tools: allowedTool.');
    expect(result.error.message).not.toContain('Available tools: allowedTool, hiddenTool');
    expect(allowedExecute).not.toHaveBeenCalled();
    expect(hiddenExecute).not.toHaveBeenCalled();
    expect(backingExecute).not.toHaveBeenCalled();
  });

  it('does not advertise fenced-out tools retained in activeTools', async () => {
    setupRegistry({
      tools: {
        allowedTool: { execute: vi.fn().mockResolvedValue('allowed') },
        hiddenTool: { execute: vi.fn().mockResolvedValue('hidden') },
      },
    });

    const result = await executeStep(
      mockPubsub(),
      makeInitData({
        options: {
          requireToolApproval: false,
          toolSurfaceFence: ['allowedTool'],
          activeTools: ['allowedTool', 'hiddenTool'],
        },
      }),
      { ...baseInput(), toolName: 'hiddenTool' },
    );

    expect(result.error).toEqual(
      expect.objectContaining({
        name: 'ToolNotFoundError',
        message: expect.stringContaining('Available tools: allowedTool.'),
      }),
    );
    expect(result.error.message).not.toContain('Available tools: allowedTool, hiddenTool');
  });

  it.each([false, 0, '', null])('resumes a suspended background task with falsy payload %#', async resumeData => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();
    const input = baseInput();
    const resume = vi.fn().mockResolvedValue({ id: 'task-resumed' });
    const dispatch = vi.fn();

    vi.mocked(resolveBackgroundConfig).mockReturnValue({ runInBackground: true } as any);
    vi.mocked(createBackgroundTask).mockReturnValue({
      checkIfSuspended: vi.fn().mockResolvedValue(true),
      resume,
      dispatch,
    } as any);

    const result = await executeStep(pubsub, initData, input, resumeData, {
      version: 1,
      type: 'suspension',
      runId: RUN_ID,
      iterationCount: 0,
      stepId: 'durable-tool-call',
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      identityDigest: createToolCallIdentityDigest({
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: input.args,
      }),
    });

    expect(resume).toHaveBeenCalledWith(resumeData);
    expect(dispatch).not.toHaveBeenCalled();
    expect(result.result).toContain('Background task resumed');
  });

  it('resumes an approved in-tool background suspension and preserves the grant', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();
    const input = baseInput();
    const resume = vi.fn().mockResolvedValue({ id: 'task-resumed' });
    const dispatch = vi.fn();
    const resumeData = { approved: true, reason: 'Reviewed by admin' };

    vi.mocked(resolveBackgroundConfig).mockReturnValue({ runInBackground: true } as any);
    vi.mocked(createBackgroundTask).mockReturnValue({
      checkIfSuspended: vi.fn().mockResolvedValue(true),
      resume,
      dispatch,
    } as any);

    const result = await executeStep(pubsub, initData, input, resumeData, {
      version: 1,
      type: 'approval',
      approvalSource: 'tool-execution',
      runId: RUN_ID,
      iterationCount: 0,
      stepId: 'durable-tool-call',
      toolCallId: TOOL_CALL_ID,
      toolName: TOOL_NAME,
      identityDigest: createToolCallIdentityDigest({
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: input.args,
      }),
    });

    expect(resume).toHaveBeenCalledWith(resumeData);
    expect(dispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      approval: { id: TOOL_CALL_ID, approved: true, reason: 'Reviewed by admin' },
    });
  });

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
      checkIfRunning: vi.fn().mockResolvedValue(false),
      restart: vi.fn(),
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
      checkIfRunning: vi.fn().mockResolvedValue(false),
      restart: vi.fn(),
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
      checkIfRunning: vi.fn().mockResolvedValue(false),
      restart: vi.fn(),
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
      checkIfRunning: vi.fn().mockResolvedValue(false),
      restart: vi.fn(),
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
        checkIfRunning: vi.fn().mockResolvedValue(false),
        restart: vi.fn(),
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

  it('onExecution hook updates message metadata with startedAt/taskId', async () => {
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
        checkIfRunning: vi.fn().mockResolvedValue(false),
        restart: vi.fn(),
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

    expect(messageList.updateMessageMetadataByToolCallId).toHaveBeenCalledWith(
      TOOL_CALL_ID,
      expect.objectContaining({
        backgroundTasks: expect.objectContaining({
          [TOOL_CALL_ID]: expect.objectContaining({
            startedAt,
            taskId: 't-e',
          }),
        }),
      }),
    );
    expect(messageList.updateToolInvocation).not.toHaveBeenCalled();
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
        checkIfRunning: vi.fn().mockResolvedValue(false),
        restart: vi.fn(),
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
        checkIfRunning: vi.fn().mockResolvedValue(false),
        restart: vi.fn(),
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
      checkIfRunning: vi.fn().mockResolvedValue(false),
      restart: vi.fn(),
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

describe('durable tool-call activeTools enforcement', () => {
  it('rejects Mastra-resolved tools outside activeTools when the run registry is unavailable', async () => {
    const pubsub = mockPubsub();
    const hiddenExecute = vi.fn().mockResolvedValue('hidden');
    vi.mocked(_resolveTool).mockReturnValue({
      execute: hiddenExecute,
    } as any);

    const result = await executeStep(
      pubsub,
      makeInitData({
        options: {
          requireToolApproval: false,
          activeTools: ['allowedTool'],
        },
      }),
      {
        ...baseInput(),
        toolName: 'hiddenTool',
      },
    );

    expect(result.error).toEqual(
      expect.objectContaining({
        name: 'ToolNotFoundError',
        message: expect.stringContaining('Available tools: allowedTool'),
      }),
    );
    expect(hiddenExecute).not.toHaveBeenCalled();
  });
});

describe('durable tool-call background revalidation', () => {
  it('revalidates the hook on each attempt; a mid-flight revocation denies the retry', async () => {
    const pubsub = mockPubsub();
    const { entry } = setupRegistry();
    const toolExecute = entry.tools[TOOL_NAME].execute;

    let granted = true;
    const hook = vi.fn(async () => (granted ? ('allow' as const) : ('deny' as const)));
    // Registry-held live context: the transported request context arrives
    // with functions stripped, exactly like a real worker boundary.
    entry.requestContext = new Map([[ON_BEFORE_TOOL_EXECUTION_KEY, hook]]);

    toolExecute.mockImplementation(async () => {
      // The grant is revoked while attempt 1 is in flight; attempt 1 fails.
      granted = false;
      throw new Error('transient failure');
    });

    vi.mocked(resolveBackgroundConfig).mockReturnValue({
      runInBackground: true,
      timeoutMs: 30_000,
      maxRetries: 1,
    } as any);

    let executor: any;
    vi.mocked(createBackgroundTask).mockImplementation((_manager: any, spec: any) => {
      executor = spec.context.executor;
      return {
        dispatch: vi.fn().mockResolvedValue({ task: { id: 'task-bg-gate' }, fallbackToSync: false }),
        checkIfRunning: vi.fn().mockResolvedValue(false),
        restart: vi.fn(),
        task: { id: 'task-bg-gate' },
        cancel: vi.fn(),
        waitForCompletion: vi.fn(),
      } as any;
    });

    const result = await executeStep(pubsub, makeInitData());
    expect(result.result).toContain('Background task started');
    expect(executor).toBeDefined();

    // Attempt 1 — revalidated (grant still held), executes, fails transiently.
    await expect(executor.execute({ topic: 'quantum' }, {})).rejects.toThrow('transient failure');
    expect(toolExecute).toHaveBeenCalledTimes(1);

    // Attempt 2 — grant revoked in between: revalidation denies before any
    // side effect, with the name the bg-task workflow classifies non-retryable.
    await expect(executor.execute({ topic: 'quantum' }, {})).rejects.toMatchObject({
      name: TOOL_PERMISSION_DENIED_ERROR_NAME,
    });
    expect(toolExecute).toHaveBeenCalledTimes(1);
    // Dispatch gate + attempt 1 + attempt 2.
    expect(hook).toHaveBeenCalledTimes(3);
  });
});
