import type { ToolSet } from '@internal/ai-sdk-v5';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ChunkFrom } from '../../../stream/types';
import { ToolStream } from '../../../tools/stream';
import type { OuterLLMRun } from '../../types';
import { createToolCallStep } from './tool-call-step';

// Shared helpers used by multiple describe blocks
const createMessageList = () =>
  ({
    get: {
      input: { aiV5: { model: () => [] } },
      response: { db: () => [] },
      all: { db: () => [] },
    },
  }) as unknown as MessageList;

const makeBaseExecuteParams = (suspend: Mock, overrides: any = {}) => ({
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
  validateSchemas: false,
  ...overrides,
});

describe('createToolCallStep tool approval workflow', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let tools: Record<string, { execute: Mock; requireApproval: boolean }>;
  let messageList: MessageList;
  let toolCallStep: ReturnType<typeof createToolCallStep>;
  let neverResolve: Promise<never>;

  const makeInputData = () => ({
    toolCallId: 'test-call-id',
    toolName: 'test-tool',
    args: { param: 'test' },
  });

  const makeExecuteParams = (overrides: any = {}) => ({
    ...makeBaseExecuteParams(suspend),
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'test-call-id',
      name: 'test-tool',
      runId: 'test-run-id',
    }),
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
    messageList = createMessageList();

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

describe('createToolCallStep provider-executed tools', () => {
  let controller: ReadableStreamDefaultController;
  let suspend: Mock;
  let messageList: MessageList;

  beforeEach(() => {
    controller = {
      enqueue: vi.fn(),
      desiredSize: 1,
      close: vi.fn(),
      error: vi.fn(),
    } as unknown as ReadableStreamDefaultController;
    suspend = vi.fn();
    messageList = createMessageList();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should skip execution and return pre-merged output for provider-executed tools', async () => {
    const providerResult = { results: [{ title: 'Example', url: 'https://example.com' }] };
    const executeFn = vi.fn();
    const tools = {
      webSearch: {
        type: 'provider-defined' as const,
        id: 'openai.web_search',
        execute: executeFn,
      },
    } as unknown as ToolSet;

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
    } as unknown as OuterLLMRun);

    const inputData = {
      toolCallId: 'call-123',
      toolName: 'web_search',
      args: { query: 'test' },
      providerExecuted: true,
      output: providerResult,
    };

    const result = await step.execute({
      ...makeBaseExecuteParams(suspend),
      writer: new ToolStream({ prefix: 'tool', callId: 'call-123', name: 'web_search', runId: 'test-run' }),
      inputData,
    });

    expect(result).toEqual(expect.objectContaining({ result: providerResult }));
    expect(executeFn).not.toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
  });

  it('should execute normally when providerExecuted is false', async () => {
    const toolResult = { data: 'calculated' };
    const executeFn = vi.fn().mockResolvedValue(toolResult);
    const tools = {
      calculator: {
        execute: executeFn,
      },
    } as unknown as ToolSet;

    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
    } as unknown as OuterLLMRun);

    const inputData = {
      toolCallId: 'call-789',
      toolName: 'calculator',
      args: { expression: '2+2' },
      providerExecuted: false,
    };

    const result = await step.execute({
      ...makeBaseExecuteParams(suspend),
      writer: new ToolStream({ prefix: 'tool', callId: 'call-789', name: 'calculator', runId: 'test-run' }),
      inputData,
    });

    expect(executeFn).toHaveBeenCalledWith({ expression: '2+2' }, expect.objectContaining({ toolCallId: 'call-789' }));
    expect(result).toEqual(expect.objectContaining({ result: toolResult }));
  });
});
