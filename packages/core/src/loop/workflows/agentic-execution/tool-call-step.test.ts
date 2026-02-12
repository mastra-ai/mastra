import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ChunkFrom } from '../../../stream/types';
import { ToolStream } from '../../../tools/stream';
import { createToolCallStep } from './tool-call-step';

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
        error: expect.objectContaining({ message: 'Tool unknown-tool not found' }),
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
    ).rejects.toThrow('Tool missing-tool not found');
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
        error: expect.objectContaining({ message: 'Tool still-missing not found after repair' }),
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
