import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { MessageList } from '../../../agent/message-list';
import { RuntimeContext } from '../../../runtime-context';
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
    runtimeContext: new RuntimeContext(),
    state: {},
    setState: vi.fn(),
    runCount: 1,
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
    expect(controller.enqueue).toHaveBeenCalledWith({
      type: 'tool-call-approval',
      runId: 'test-run',
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'test' },
      },
    });

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
        resumeData,
      }),
    );
    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({
      result: toolResult,
      ...inputData,
    });
  });
});
