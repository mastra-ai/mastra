import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ChunkFrom } from '../../../stream/types';
import { createTool } from '../../../tools';
import { ToolStream } from '../../../tools/stream';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
import type { MastraToolInvocationOptions } from '../../../tools/types';
import { createToolCallStep } from './tool-call-step';

describe('createToolCallStep tool execution error handling', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let messageList: MessageList;

  const makeInputData = () => ({
    toolCallId: 'test-call-id',
    toolName: 'failing-tool',
    args: { param: 'test' },
  });

  const makeExecuteParams = (overrides: any = {}) => ({
    runId: 'test-run-id',
    workflowId: 'test-workflow-id',
    mastra: {} as any,
    requestContext: new RequestContext(),
    state: {},
    setState: vi.fn(),
    retryCount: 1,
    tracingContext: {} as any,
    getInitData: vi.fn(),
    getStepResult: vi.fn(),
    suspend,
    bail: vi.fn(),
    abort: vi.fn(),
    engine: 'default' as any,
    abortSignal: new AbortController().signal,
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'test-call-id',
      name: 'failing-tool',
      runId: 'test-run-id',
    }),
    validateSchemas: false,
    inputData: makeInputData(),
    ...overrides,
  });

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    suspend = vi.fn();
    streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: { db: () => [] },
      },
    } as unknown as MessageList;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should return error field (not result) when a CoreToolBuilder-built tool throws', async () => {
    // Arrange: Build a tool through CoreToolBuilder whose execute throws
    // This is the exact path used in production — CoreToolBuilder wraps the execute function
    const failingTool = createTool({
      id: 'failing-tool',
      description: 'A tool that throws',
      inputSchema: z.object({ param: z.string() }),
      execute: async () => {
        throw new Error('External API error: 503 Service Unavailable');
      },
    });

    const builder = new CoreToolBuilder({
      originalTool: failingTool,
      options: {
        name: 'failing-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'A tool that throws',
        requestContext: new RequestContext(),
      },
    });

    const builtTool = builder.build();

    const tools = { 'failing-tool': builtTool };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = makeInputData();

    // Act: Execute the tool call step
    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    // Assert: The result should have an 'error' field, NOT a 'result' field containing a MastraError.
    // When the result has a 'result' field (even if it contains a MastraError), the llm-mapping-step
    // emits 'tool-result' instead of 'tool-error', preventing consumers from distinguishing
    // errors from successful results by chunk type.
    expect(result).toHaveProperty('error');
    expect(result).not.toHaveProperty('result');
    expect(result.error).toBeInstanceOf(Error);
  });
});

describe('createToolCallStep tool approval workflow', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let tools: Record<string, { execute: Mock; requireApproval: boolean }>;
  let messageList: MessageList;
  let toolCallStep: ReturnType<typeof createToolCallStep>;
  let neverResolve: Promise<never>;

  // Helper functions to reduce duplication
  const makeInputData = () => ({
    toolCallId: 'test-call-id',
    toolName: 'test-tool',
    args: { param: 'test' },
  });

  const makeExecuteParams = (overrides: any = {}) => ({
    runId: 'test-run-id',
    workflowId: 'test-workflow-id',
    mastra: {} as any,
    requestContext: new RequestContext(),
    state: {},
    setState: vi.fn(),
    retryCount: 1,
    tracingContext: {} as any,
    getInitData: vi.fn(),
    getStepResult: vi.fn(),
    suspend,
    bail: vi.fn(),
    abort: vi.fn(),
    engine: 'default' as any,
    abortSignal: new AbortController().signal,
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'test-call-id',
      name: 'test-tool',
      runId: 'test-run-id',
    }),
    validateSchemas: false,
    inputData: makeInputData(),
    ...overrides,
  });

  const expectNoToolExecution = () => {
    expect(tools['test-tool'].execute).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
    };
    neverResolve = new Promise(() => {});
    suspend = vi.fn().mockReturnValue(neverResolve);
    streamState = {
      serialize: vi.fn().mockReturnValue('serialized-state'),
    };
    tools = {
      'test-tool': {
        execute: vi.fn(),
        requireApproval: true,
      },
    };
    messageList = {
      get: {
        input: {
          aiV5: {
            model: () => [],
          },
        },
        response: {
          db: () => [],
        },
        all: {
          db: () => [],
        },
      },
    } as unknown as MessageList;

    toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should enqueue approval message and prevent execution when approval is required', async () => {
    // Arrange: Set up tool call input data
    const inputData = makeInputData();

    // Act: Execute the tool call step
    const executePromise = toolCallStep.execute(makeExecuteParams({ inputData }));

    // Assert: Verify approval flow and execution prevention
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-call-approval',
        runId: 'test-run',
        from: ChunkFrom.AGENT,
        payload: expect.objectContaining({
          toolCallId: 'test-call-id',
          toolName: 'test-tool',
          args: { param: 'test' },
        }),
      }),
    );

    // Wait for flushMessagesBeforeSuspension to complete before suspend is called
    await new Promise(resolve => setImmediate(resolve));

    expect(suspend).toHaveBeenCalledWith(
      {
        requireToolApproval: {
          toolCallId: 'test-call-id',
          toolName: 'test-tool',
          args: { param: 'test' },
        },
        __streamState: 'serialized-state',
      },
      {
        resumeLabel: 'test-call-id',
      },
    );

    expectNoToolExecution();

    // Verify execution remains suspended
    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('should handle declined tool calls without executing the tool', async () => {
    // Arrange: Set up tool call input data and declined resumeData
    const inputData = makeInputData();
    const resumeData = { approved: false };

    // Act: Execute the tool call step with declined approval
    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

    // Assert: Verify error handling and execution prevention
    expect(result).toEqual({
      result: 'Tool call was not approved by the user',
      ...inputData,
    });
    expectNoToolExecution();
  });

  it('should return a fallback result for provider-executed tools without output', async () => {
    // Arrange: provider-executed tool with no output (the bug scenario from #13125)
    const inputData = {
      ...makeInputData(),
      toolName: 'web_search_20250305',
      providerExecuted: true,
    };

    // Act: Execute the tool call step
    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    // Assert: Should return a non-undefined result to prevent bail in llm-mapping-step
    expect(result.result).toEqual({ providerExecuted: true, toolName: 'web_search_20250305' });
    expectNoToolExecution();
  });

  it('should pass through output for provider-executed tools when output is present', async () => {
    // Arrange: provider-executed tool with output
    const inputData = {
      ...makeInputData(),
      toolName: 'web_search_20250305',
      providerExecuted: true,
      output: { searchResults: ['result1'] },
    };

    // Act
    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    // Assert: Should use the actual output, not the fallback
    expect(result.result).toEqual({ searchResults: ['result1'] });
    expectNoToolExecution();
  });

  it('executes the tool and returns result when approval is granted', async () => {
    // Arrange: Set up input data and mock tool execution result
    const inputData = makeInputData();
    const toolResult = { success: true, data: 'test-result' };
    tools['test-tool'].execute.mockResolvedValue(toolResult);
    const resumeData = { approved: true };

    // Act: Execute tool call step with approval
    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

    // Assert: Verify tool execution and return value
    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        toolCallId: inputData.toolCallId,
        messages: [],
      }),
    );
    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({
      result: toolResult,
      ...inputData,
    });
  });
});

describe('createToolCallStep requestContext forwarding', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let messageList: MessageList;

  const makeInputData = () => ({
    toolCallId: 'ctx-call-id',
    toolName: 'ctx-tool',
    args: { key: 'value' },
  });

  const makeExecuteParams = (overrides: any = {}) => ({
    runId: 'ctx-run-id',
    workflowId: 'ctx-workflow-id',
    mastra: {} as any,
    requestContext: new RequestContext(),
    state: {},
    setState: vi.fn(),
    retryCount: 1,
    tracingContext: {} as any,
    getInitData: vi.fn(),
    getStepResult: vi.fn(),
    suspend,
    bail: vi.fn(),
    abort: vi.fn(),
    engine: 'default' as any,
    abortSignal: new AbortController().signal,
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'ctx-call-id',
      name: 'ctx-tool',
      runId: 'ctx-run-id',
    }),
    validateSchemas: false,
    inputData: makeInputData(),
    ...overrides,
  });

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    suspend = vi.fn();
    streamState = { serialize: vi.fn().mockReturnValue('serialized') };
    messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: { db: () => [] },
      },
    } as unknown as MessageList;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('forwards requestContext to tool.execute in toolOptions', async () => {
    // Arrange: create a requestContext with a custom value
    const requestContext = new RequestContext();
    requestContext.set('testKey', 'testValue');
    requestContext.set('apiClient', { fetch: () => 'mocked' });

    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'ctx-tool': {
        execute: vi.fn((_args: any, opts: MastraToolInvocationOptions) => {
          capturedOptions = opts;
          return Promise.resolve({ ok: true });
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'ctx-run',
      streamState,
    });

    const inputData = makeInputData();

    // Act
    const result = await toolCallStep.execute(makeExecuteParams({ inputData, requestContext }));

    // Assert: tool was called and requestContext was forwarded
    expect(tools['ctx-tool'].execute).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions!.requestContext).toBe(requestContext);
    expect(capturedOptions!.requestContext!.get('testKey')).toBe('testValue');
    expect(capturedOptions!.requestContext!.get('apiClient')).toEqual({ fetch: expect.any(Function) });
    expect(result).toEqual({ result: { ok: true }, ...inputData });
  });

  it('forwards an empty requestContext when no values are set', async () => {
    const requestContext = new RequestContext();

    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'ctx-tool': {
        execute: vi.fn((_args: any, opts: MastraToolInvocationOptions) => {
          capturedOptions = opts;
          return Promise.resolve('done');
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'ctx-run',
      streamState,
    });

    const inputData = makeInputData();

    // Act
    await toolCallStep.execute(makeExecuteParams({ inputData, requestContext }));

    // Assert: requestContext is forwarded even when empty
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions!.requestContext).toBe(requestContext);
  });
});

describe('createToolCallStep empty resumeData normalization', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let messageList: MessageList;

  const makeExecuteParams = (overrides: any = {}) => ({
    runId: 'test-run-id',
    workflowId: 'test-workflow-id',
    mastra: {} as any,
    requestContext: new RequestContext(),
    state: {},
    setState: vi.fn(),
    retryCount: 1,
    tracingContext: {} as any,
    getInitData: vi.fn(),
    getStepResult: vi.fn(),
    suspend,
    bail: vi.fn(),
    abort: vi.fn(),
    engine: 'default' as any,
    abortSignal: new AbortController().signal,
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'test-call-id',
      name: 'workflow-test',
      runId: 'test-run-id',
    }),
    validateSchemas: false,
    ...overrides,
  });

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    suspend = vi.fn();
    streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: {
          db: () => [],
          aiV5: { model: () => [] },
        },
      },
    } as unknown as MessageList;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should not trigger runId lookup when workflowResumeData is an empty object', async () => {
    // Bug: When workflowResumeData is {}, it's truthy, causing needsRunIdLookup to fire
    // on fresh workflow tool calls. This injects a stale suspendedToolRunId from message
    // history into args, making the workflow try to resume a non-existent run.
    let capturedArgs: any;
    const tools = {
      'workflow-test': {
        execute: vi.fn((args: any) => {
          capturedArgs = args;
          return Promise.resolve({ success: true });
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = {
      toolCallId: 'call-1',
      toolName: 'workflow-test',
      args: { taskId: 'task-123' },
    };

    // workflowResumeData = {} simulates the scenario where the workflow step
    // receives an empty resume data object (which is truthy but has no content)
    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData: {} }));

    expect(result.result).toEqual({ success: true });
    // The key assertion: suspendedToolRunId should NOT be injected into args
    expect(capturedArgs).not.toHaveProperty('suspendedToolRunId');
  });

  it('should execute tool normally when resumeData in args is an empty object', async () => {
    // When LLM generates args with resumeData: {}, it should be treated as
    // a fresh call, not a resume. The empty {} should be normalized to undefined.
    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'workflow-test': {
        execute: vi.fn((_args: any, opts: MastraToolInvocationOptions) => {
          capturedOptions = opts;
          return Promise.resolve({ done: true });
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = {
      toolCallId: 'call-2',
      toolName: 'workflow-test',
      // LLM generates args with empty resumeData and suspendedToolRunId
      args: { taskId: 'task-456', resumeData: {} },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.result).toEqual({ done: true });
    // resumeData passed to tool options should be undefined (not {})
    expect(capturedOptions!.resumeData).toBeUndefined();
  });

  it('should still pass non-empty resumeData through correctly', async () => {
    // Ensure the fix doesn't break legitimate resume scenarios
    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'workflow-test': {
        execute: vi.fn((_args: any, opts: MastraToolInvocationOptions) => {
          capturedOptions = opts;
          return Promise.resolve({ resumed: true });
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = {
      toolCallId: 'call-3',
      toolName: 'workflow-test',
      args: { taskId: 'task-789', resumeData: { stepResult: 'completed' } },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.result).toEqual({ resumed: true });
    // Non-empty resumeData should be passed through
    expect(capturedOptions!.resumeData).toEqual({ stepResult: 'completed' });
  });

  it('should not use LLM-hallucinated suspendedToolRunId with empty resumeData (Ruslan scenario)', async () => {
    // This reproduces the exact bug from the Discord thread:
    // The LLM hallucinates both suspendedToolRunId and resumeData: {} in tool args
    // after seeing suspended tool metadata in conversation history.
    //
    // Ruslan's error output showed:
    //   {"inputData": {"taskId": "cmm..."}, "suspendedToolRunId": "run_7y1us0b7xn", "resumeData": {}}
    //
    // The expected behavior: empty resumeData should be normalized to undefined,
    // and the hallucinated suspendedToolRunId should NOT be passed downstream
    // to cause the workflow to try resuming a stale/completed run.
    let capturedArgs: any;
    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'workflow-fetch-task': {
        execute: vi.fn((args: any, opts: MastraToolInvocationOptions) => {
          capturedArgs = args;
          capturedOptions = opts;
          return Promise.resolve({ task: { id: 'task-123', status: 'pending' } });
        }),
      },
    };

    // Message history contains metadata from a previous suspension of this same tool
    const suspendedMessages = [
      {
        role: 'assistant',
        content: {
          metadata: {
            suspendedTools: {
              'workflow-fetch-task': { runId: 'run_7y1us0b7xn', toolCallId: 'old-call-id' },
            },
          },
          parts: [],
        },
      },
    ];

    const messageListWithHistory = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: {
          db: () => suspendedMessages,
          aiV5: { model: () => [] },
        },
      },
    } as unknown as MessageList;

    const toolCallStep = createToolCallStep({
      tools,
      messageList: messageListWithHistory,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = {
      toolCallId: 'call-new',
      toolName: 'workflow-fetch-task',
      // LLM hallucinates both fields after seeing suspended tool metadata
      args: {
        taskId: 'cmmmimw7i00otxvewo8qgqaea',
        suspendedToolRunId: 'run_7y1us0b7xn',
        resumeData: {},
      },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.result).toEqual({ task: { id: 'task-123', status: 'pending' } });
    // Empty resumeData should be normalized to undefined in tool options
    expect(capturedOptions!.resumeData).toBeUndefined();
    // The hallucinated suspendedToolRunId should NOT be used for workflow execution.
    // Even though the LLM put it in args, with empty resumeData it's a fresh call.
    // The downstream workflow tool should use a new runId, not the stale one.
    //
    // NOTE: Currently, args.suspendedToolRunId passes through because
    // isResumeToolCall=true (LLM provided resumeData:{}) which causes
    // needsRunIdLookup=false (the lookup is skipped since args already has the ID).
    // The fix needs to strip suspendedToolRunId from args when resumeData is empty.
    expect(capturedArgs.suspendedToolRunId).toBeUndefined();
  });

  it('should not inject suspendedToolRunId when workflowResumeData is {} for workflow-prefixed tools', async () => {
    // This specifically tests the needsRunIdLookup guard with a workflow-prefixed tool name
    // When resumeData is {}, even with suspended tool metadata in message history,
    // the runId should NOT be looked up or injected.
    const suspendedMessages = [
      {
        role: 'assistant',
        content: {
          metadata: {
            suspendedTools: {
              'workflow-deploy': { runId: 'old-stale-run-id', toolCallId: 'old-call' },
            },
          },
          parts: [],
        },
      },
    ];

    const messageListWithHistory = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: {
          db: () => suspendedMessages,
          aiV5: { model: () => [] },
        },
      },
    } as unknown as MessageList;

    let capturedArgs: any;
    const tools = {
      'workflow-deploy': {
        execute: vi.fn((args: any) => {
          capturedArgs = args;
          return Promise.resolve({ deployed: true });
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList: messageListWithHistory,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = {
      toolCallId: 'call-4',
      toolName: 'workflow-deploy',
      args: { taskId: 'task-abc' },
    };

    // Empty resumeData should NOT trigger runId lookup
    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData: {} }));

    expect(result.result).toEqual({ deployed: true });
    // Even though message history has a suspended 'workflow-deploy' tool,
    // suspendedToolRunId should NOT be injected because this is a fresh call
    expect(capturedArgs).not.toHaveProperty('suspendedToolRunId');
  });

  it('should preserve suspendedToolRunId and resumeData when resume is legitimate', async () => {
    // A legitimate resume: LLM provides non-empty resumeData AND a valid suspendedToolRunId.
    // Both should pass through to the tool — the runId is used to resume the correct workflow run,
    // and resumeData carries the user's response (e.g., { serverRegion: 'eu-west' }).
    let capturedArgs: any;
    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'workflow-deploy': {
        execute: vi.fn((args: any, opts: MastraToolInvocationOptions) => {
          capturedArgs = args;
          capturedOptions = opts;
          return Promise.resolve({ deployed: true });
        }),
      },
    };

    const suspendedMessages = [
      {
        role: 'assistant',
        content: {
          metadata: {
            suspendedTools: {
              'workflow-deploy': { runId: 'run_valid_123', toolCallId: 'old-call' },
            },
          },
          parts: [],
        },
      },
    ];

    const messageListWithHistory = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: {
          db: () => suspendedMessages,
          aiV5: { model: () => [] },
        },
      },
    } as unknown as MessageList;

    const toolCallStep = createToolCallStep({
      tools,
      messageList: messageListWithHistory,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    const inputData = {
      toolCallId: 'call-resume',
      toolName: 'workflow-deploy',
      // LLM correctly provides both fields for a legitimate resume
      args: {
        taskId: 'task-xyz',
        suspendedToolRunId: 'run_valid_123',
        resumeData: { serverRegion: 'eu-west' },
      },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.result).toEqual({ deployed: true });
    // Non-empty resumeData should be passed through to tool options
    expect(capturedOptions!.resumeData).toEqual({ serverRegion: 'eu-west' });
    // The valid suspendedToolRunId should be preserved in args (needed by workflow tool execute)
    expect(capturedArgs.suspendedToolRunId).toBe('run_valid_123');
  });

  it('should strip suspendedToolRunId when LLM hallucinates only suspendedToolRunId without resumeData', async () => {
    // Edge case: LLM hallucinates a stale suspendedToolRunId but does NOT include resumeData.
    // Without a guard, the stale ID passes through and can be used downstream as a workflow run ID
    // on what should be a fresh call.
    let capturedArgs: any;
    let capturedOptions: MastraToolInvocationOptions | undefined;
    const tools = {
      'workflow-deploy': {
        execute: vi.fn((args: any, opts: MastraToolInvocationOptions) => {
          capturedArgs = args;
          capturedOptions = opts;
          return Promise.resolve({ deployed: true });
        }),
      },
    };

    const toolCallStep = createToolCallStep({
      tools: tools as any,
      controller: { enqueue: controller.enqueue } as any,
      messageList,
      suspend,
      streamState: streamState as any,
    });

    const inputData = {
      toolCallId: 'call-1',
      toolName: 'workflow-deploy',
      // LLM hallucinated only suspendedToolRunId, no resumeData
      args: {
        taskId: 'task-fresh',
        suspendedToolRunId: 'run_stale_from_history',
      },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.result).toEqual({ deployed: true });
    // resumeData should be undefined (none was provided)
    expect(capturedOptions!.resumeData).toBeUndefined();
    // Stale suspendedToolRunId should be stripped since this is a fresh call (no resumeData)
    expect(capturedArgs).not.toHaveProperty('suspendedToolRunId');
  });
});

describe('createToolCallStep malformed JSON args (issue #9815)', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let tools: Record<string, { execute: Mock }>;
  let messageList: MessageList;

  const makeExecuteParams = (overrides: any = {}) => ({
    runId: 'test-run-id',
    workflowId: 'test-workflow-id',
    mastra: {} as any,
    requestContext: new RequestContext(),
    state: {},
    setState: vi.fn(),
    retryCount: 1,
    tracingContext: {} as any,
    getInitData: vi.fn(),
    getStepResult: vi.fn(),
    suspend,
    bail: vi.fn(),
    abort: vi.fn(),
    engine: 'default' as any,
    abortSignal: new AbortController().signal,
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'test-call-id',
      name: 'test-tool',
      runId: 'test-run-id',
    }),
    validateSchemas: false,
    ...overrides,
  });

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
    };
    suspend = vi.fn();
    streamState = {
      serialize: vi.fn().mockReturnValue('serialized-state'),
    };
    tools = {
      'test-tool': {
        execute: vi.fn().mockResolvedValue({ success: true }),
      },
    };
    messageList = {
      get: {
        input: {
          aiV5: {
            model: () => [],
          },
        },
        response: {
          db: () => [],
        },
        all: {
          db: () => [],
        },
      },
    } as unknown as MessageList;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should return a descriptive error when args are undefined (malformed JSON from model)', async () => {
    // Issue #9815: When the model emits invalid JSON for tool call args,
    // the stream transform sets args to undefined. The tool-call-step should
    // detect this and return a clear error message telling the model its JSON
    // was malformed, rather than blindly calling tool.execute(undefined).

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    });

    const inputData = {
      toolCallId: 'call-1',
      toolName: 'test-tool',
      args: undefined, // Simulates malformed JSON from model — transform.ts sets this to undefined
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    // Should NOT call tool.execute — the args are invalid
    expect(tools['test-tool'].execute).not.toHaveBeenCalled();

    // Should return an error (not throw)
    expect(result.error).toBeDefined();

    // The error message should clearly indicate the JSON was malformed,
    // so the model knows to fix its JSON output
    expect(result.error.message).toMatch(/invalid|malformed|json|args|arguments/i);
  });

  it('should return a descriptive error when args are null (malformed JSON from model)', async () => {
    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    });

    const inputData = {
      toolCallId: 'call-1',
      toolName: 'test-tool',
      args: null, // Another form of malformed args
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    // Should NOT call tool.execute
    expect(tools['test-tool'].execute).not.toHaveBeenCalled();

    // Should return a descriptive error
    expect(result.error).toBeDefined();
    expect(result.error.message).toMatch(/invalid|malformed|json|args|arguments/i);
  });
});
