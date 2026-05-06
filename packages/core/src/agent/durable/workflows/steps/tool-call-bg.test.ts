import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../../request-context';
import { setToolGateRuntimeStateForRun } from '../../../../tools/tool-gate';
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
const { resolveTool: _resolveTool, toolRequiresApproval } = await import('../../utils/resolve-runtime');

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

function copySerializableRequestContext(requestContext: RequestContext) {
  return new RequestContext(Array.from(requestContext.entries()));
}

function executeStep(
  pubsub: any,
  initData: any,
  input?: any,
  resumeData?: any,
  overrides: { requestContext?: RequestContext; suspend?: ReturnType<typeof vi.fn> } = {},
) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: input ?? baseInput(),
    mastra: { getLogger: () => undefined },
    suspend: overrides.suspend ?? vi.fn(),
    resumeData,
    requestContext: overrides.requestContext ?? new RequestContext(),
    getInitData: () => initData,
    [PUBSUB_SYMBOL]: pubsub,
  });
}

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call background task dispatch', () => {
  it('rejects a durable tool call denied by Tool Gate before execution', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const { entry } = setupRegistry({ requestContext });
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'deny-durable-tool',
        evaluate: async ({ subject }) => ({
          effect: subject.boundary === 'tool-call' ? 'deny' : 'allow',
          reason: 'blocked in durable run',
        }),
      },
    });

    const result = await executeStep(
      pubsub,
      makeInitData({
        state: {
          threadId: 'thread-1',
          resourceId: 'user-1',
          toolGate: { policyId: 'deny-durable-tool' },
        },
      }),
      undefined,
      undefined,
      { requestContext },
    );

    expect(result.error).toMatchObject({
      name: 'ToolNotFoundError',
      message: expect.stringContaining('blocked by runtime tool policy'),
    });
    expect(entry.tools[TOOL_NAME].execute).not.toHaveBeenCalled();
    expect(vi.mocked(emitChunkEvent)).toHaveBeenCalledWith(
      pubsub,
      RUN_ID,
      expect.objectContaining({
        type: 'tool-error',
        payload: expect.objectContaining({
          toolCallId: TOOL_CALL_ID,
          toolName: TOOL_NAME,
        }),
      }),
    );
  });

  it('rejects durable tool calls when serialized Tool Gate state has no runtime policy', async () => {
    const pubsub = mockPubsub();
    const { entry } = setupRegistry();

    const result = await executeStep(
      pubsub,
      makeInitData({
        state: {
          threadId: 'thread-1',
          resourceId: 'user-1',
          toolGate: { policyId: 'missing-runtime-policy' },
        },
      }),
    );

    expect(result.error).toMatchObject({
      name: 'ToolNotFoundError',
      message: expect.stringContaining('missing-runtime-policy'),
    });
    expect(entry.tools[TOOL_NAME].execute).not.toHaveBeenCalled();
  });

  it('rejects durable tool calls when serialized Tool Gate policy does not match runtime policy', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const { entry } = setupRegistry({ requestContext });
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'wrong-runtime-policy',
        evaluate: async () => ({ effect: 'allow', reason: 'wrong policy allows everything' }),
      },
    });

    const result = await executeStep(
      pubsub,
      makeInitData({
        state: {
          threadId: 'thread-1',
          resourceId: 'user-1',
          toolGate: { policyId: 'original-runtime-policy' },
        },
      }),
      undefined,
      undefined,
      { requestContext },
    );

    expect(result.error).toMatchObject({
      name: 'ToolNotFoundError',
      message: expect.stringContaining('original-runtime-policy'),
    });
    expect(result.error.message).toContain('wrong-runtime-policy');
    expect(entry.tools[TOOL_NAME].execute).not.toHaveBeenCalled();
  });

  it('does not apply an ambient Tool Gate policy when durable state has no policy id', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const { entry } = setupRegistry({ requestContext, backgroundTaskManager: undefined });
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'ambient-policy',
        evaluate: async () => ({ effect: 'deny', reason: 'ambient policy should not apply' }),
      },
    });

    const result = await executeStep(pubsub, makeInitData(), undefined, undefined, { requestContext });

    expect(result.result).toEqual({ summary: 'done' });
    expect(entry.tools[TOOL_NAME].execute).toHaveBeenCalledOnce();
  });

  it('uses the registry request context instead of a transient step context for Tool Gate policy', async () => {
    const pubsub = mockPubsub();
    const registryRequestContext = new RequestContext();
    const { entry } = setupRegistry({ requestContext: registryRequestContext, backgroundTaskManager: undefined });
    setToolGateRuntimeStateForRun(registryRequestContext, RUN_ID, {
      policy: {
        id: 'allow-durable-tool',
        evaluate: async () => ({ effect: 'allow', reason: 'registry policy allows the tool' }),
      },
    });

    const result = await executeStep(
      pubsub,
      makeInitData({
        state: {
          threadId: 'thread-1',
          resourceId: 'user-1',
          toolGate: { policyId: 'allow-durable-tool' },
        },
      }),
      undefined,
      undefined,
      { requestContext: new RequestContext() },
    );

    expect(result.result).toEqual({ summary: 'done' });
    expect(entry.tools[TOOL_NAME].execute).toHaveBeenCalledOnce();
  });

  it('escalates durable approval when Tool Gate requires approval', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const suspend = vi.fn();
    const { entry } = setupRegistry({ requestContext });
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'approve-durable-tool',
        evaluate: async ({ subject }) => ({
          effect: subject.boundary === 'tool-call' ? 'requireApproval' : 'allow',
          reason: 'approval required in durable run',
        }),
      },
    });

    await executeStep(
      pubsub,
      makeInitData({
        state: {
          threadId: 'thread-1',
          resourceId: 'user-1',
          toolGate: { policyId: 'approve-durable-tool' },
        },
      }),
      undefined,
      undefined,
      { requestContext, suspend },
    );

    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'approval',
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
      }),
      { resumeLabel: TOOL_CALL_ID },
    );
    expect(entry.tools[TOOL_NAME].execute).not.toHaveBeenCalled();
  });

  it('rejects approval-required durable tool calls when resume data does not approve them', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const { entry } = setupRegistry({ requestContext });
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy: {
        id: 'approve-durable-tool',
        evaluate: async ({ subject }) => ({
          effect: subject.boundary === 'tool-call' ? 'requireApproval' : 'allow',
          reason: 'approval required in durable run',
        }),
      },
    });

    const result = await executeStep(
      pubsub,
      makeInitData({
        state: {
          threadId: 'thread-1',
          resourceId: 'user-1',
          toolGate: { policyId: 'approve-durable-tool' },
        },
      }),
      undefined,
      {},
      { requestContext },
    );

    expect(result).toMatchObject({
      result: 'Tool call approval was not provided by the user',
      denied: true,
      deniedReason: 'Tool call approval was not provided by the user',
    });
    expect(entry.tools[TOOL_NAME].execute).not.toHaveBeenCalled();
  });

  it('allows an approved durable tool call to resume later with tool-specific resume data', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const { entry } = setupRegistry({ requestContext, backgroundTaskManager: undefined });
    entry.tools[TOOL_NAME].execute.mockImplementation(async (_args: any, context: any) => ({
      resumeData: context.resumeData,
    }));
    const policy = {
      id: 'approve-durable-tool',
      evaluate: async ({ subject }: any) => ({
        effect: subject.boundary === 'tool-call' ? 'requireApproval' : 'allow',
        reason: 'approval required in durable run',
      }),
    } as const;
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, {
      policy,
    });

    const initData = makeInitData({
      state: {
        threadId: 'thread-1',
        resourceId: 'user-1',
        toolGate: { policyId: 'approve-durable-tool' },
      },
    });

    await executeStep(pubsub, initData, undefined, { approved: true }, { requestContext });

    const replayRequestContext = copySerializableRequestContext(requestContext);
    setToolGateRuntimeStateForRun(replayRequestContext, RUN_ID, { policy });

    const result = await executeStep(
      pubsub,
      initData,
      undefined,
      { continue: true },
      { requestContext: replayRequestContext },
    );

    expect(result.result).toEqual({ resumeData: { continue: true } });
    expect(entry.tools[TOOL_NAME].execute).toHaveBeenCalledTimes(2);
  });

  it('does not re-suspend a replayed durable tool call that was already approved', async () => {
    const pubsub = mockPubsub();
    const requestContext = new RequestContext();
    const suspend = vi.fn();
    const { entry } = setupRegistry({ requestContext, backgroundTaskManager: undefined });
    const policy = {
      id: 'approve-durable-tool',
      evaluate: async ({ subject }: any) => ({
        effect: subject.boundary === 'tool-call' ? 'requireApproval' : 'allow',
        reason: 'approval required in durable run',
      }),
    } as const;
    setToolGateRuntimeStateForRun(requestContext, RUN_ID, { policy });

    const initData = makeInitData({
      state: {
        threadId: 'thread-1',
        resourceId: 'user-1',
        toolGate: { policyId: 'approve-durable-tool' },
      },
    });

    await executeStep(pubsub, initData, undefined, { approved: true }, { requestContext });

    const replayRequestContext = copySerializableRequestContext(requestContext);
    setToolGateRuntimeStateForRun(replayRequestContext, RUN_ID, { policy });

    const result = await executeStep(pubsub, initData, undefined, undefined, {
      requestContext: replayRequestContext,
      suspend,
    });

    expect(result.result).toEqual({ summary: 'done' });
    expect(suspend).not.toHaveBeenCalled();
    expect(entry.tools[TOOL_NAME].execute).toHaveBeenCalledTimes(2);
  });

  it('passes approval resume data through for in-execution tool approval resumes', async () => {
    const pubsub = mockPubsub();
    const { entry } = setupRegistry({ backgroundTaskManager: undefined });
    entry.tools[TOOL_NAME].execute.mockImplementation(async (_args: any, context: any) => ({
      resumeData: context.resumeData,
    }));

    const result = await executeStep(pubsub, makeInitData(), undefined, { approved: true });

    expect(result.result).toEqual({ resumeData: { approved: true } });
  });

  it('emits denied tool-result chunk via PubSub when approval resume is declined', async () => {
    const pubsub = mockPubsub();
    setupRegistry();
    const initData = makeInitData();
    vi.mocked(toolRequiresApproval).mockResolvedValueOnce(true);

    const result = await executeStep(pubsub, initData, undefined, { approved: false });

    expect(result).toMatchObject({
      result: 'Tool call was not approved by the user',
      denied: true,
      deniedReason: 'Tool call was not approved by the user',
    });
    expect(vi.mocked(emitChunkEvent)).toHaveBeenCalledWith(
      pubsub,
      RUN_ID,
      expect.objectContaining({
        type: 'tool-result',
        payload: expect.objectContaining({
          toolCallId: TOOL_CALL_ID,
          toolName: TOOL_NAME,
          result: 'Tool call was not approved by the user',
          denied: true,
          deniedReason: 'Tool call was not approved by the user',
        }),
      }),
    );
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
