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

describe('createToolCallStep repairToolCall hook', () => {
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
      name: 'test-tool',
      runId: 'test-run-id',
    }),
    validateSchemas: false,
    ...overrides,
  });

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    suspend = vi.fn().mockReturnValue(new Promise(() => {}));
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

  it('repairs a parseError and executes the tool with fixed args', async () => {
    const repairToolCall = vi.fn().mockResolvedValue({
      toolCallId: 'call-1',
      toolName: 'test-tool',
      args: { fixed: true },
    });
    const tools = {
      'test-tool': { execute: vi.fn().mockResolvedValue('success') },
    };

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      repairToolCall,
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'test-tool',
          args: {},
          parseError: 'Malformed JSON',
        },
      }),
    );

    expect(repairToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-1',
        toolName: 'test-tool',
        args: {},
        error: expect.any(Error),
        messages: [],
        tools,
      }),
    );
    expect(tools['test-tool'].execute).toHaveBeenCalledWith({ fixed: true }, expect.anything());
    expect(result).toEqual(expect.objectContaining({ result: 'success' }));
  });

  it('repairs a tool-not-found error by remapping to a different tool', async () => {
    const repairToolCall = vi.fn().mockResolvedValue({
      toolCallId: 'call-1',
      toolName: 'real-tool',
      args: { param: 'value' },
    });
    const tools = {
      'real-tool': { execute: vi.fn().mockResolvedValue('fixed-result') },
    };

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      repairToolCall,
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'unknown-tool',
          args: { param: 'value' },
        },
      }),
    );

    expect(repairToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'unknown-tool',
        error: expect.any(Error),
      }),
    );
    expect(tools['real-tool'].execute).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ result: 'fixed-result' }));
  });

  it('returns error when repair hook returns null for parseError', async () => {
    const repairToolCall = vi.fn().mockResolvedValue(null);
    const tools = {
      'test-tool': { execute: vi.fn() },
    };

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      repairToolCall,
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'test-tool',
          args: {},
          parseError: 'Malformed JSON',
        },
      }),
    );

    expect(repairToolCall).toHaveBeenCalled();
    expect(tools['test-tool'].execute).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Malformed JSON' }),
      }),
    );
  });

  it('throws when repair hook returns null for tool-not-found', async () => {
    const repairToolCall = vi.fn().mockResolvedValue(null);

    const step = createToolCallStep({
      tools: {},
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      repairToolCall,
    });

    await expect(
      step.execute(
        makeExecuteParams({
          inputData: {
            toolCallId: 'call-1',
            toolName: 'missing-tool',
            args: {},
          },
        }),
      ),
    ).rejects.toThrow('missing-tool');
  });

  it('returns error when repair hook itself throws for parseError', async () => {
    const repairToolCall = vi.fn().mockRejectedValue(new Error('repair failed'));
    const tools = {
      'test-tool': { execute: vi.fn() },
    };

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      repairToolCall,
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'test-tool',
          args: {},
          parseError: 'Malformed JSON',
        },
      }),
    );

    expect(tools['test-tool'].execute).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Malformed JSON' }),
      }),
    );
  });

  it('returns error when repaired tool name still not found', async () => {
    const repairToolCall = vi.fn().mockResolvedValue({
      toolCallId: 'call-1',
      toolName: 'still-missing',
      args: { fixed: true },
    });

    const step = createToolCallStep({
      tools: { 'other-tool': { execute: vi.fn() } },
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      repairToolCall,
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'bad-tool',
          args: {},
          parseError: 'Malformed JSON',
        },
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.any(Error),
      }),
    );
  });

  it('falls through to default parseError handling without repair hook', async () => {
    const tools = {
      'test-tool': { execute: vi.fn() },
    };

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      // no repairToolCall
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'call-1',
          toolName: 'test-tool',
          args: {},
          parseError: 'Bad JSON',
        },
      }),
    );

    expect(tools['test-tool'].execute).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'Bad JSON' }),
      }),
    );
  });
});
