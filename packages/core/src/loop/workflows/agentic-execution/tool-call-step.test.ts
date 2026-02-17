import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ChunkFrom } from '../../../stream/types';
import { createTool } from '../../../tools';
import { ToolStream } from '../../../tools/stream';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
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
