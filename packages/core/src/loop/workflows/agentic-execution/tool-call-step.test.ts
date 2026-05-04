import type { ToolSet } from '@internal/ai-sdk-v5';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod/v4';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { ChunkFrom } from '../../../stream/types';
import { createTool } from '../../../tools';
import { ToolStream } from '../../../tools/stream';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
import type { MastraToolInvocationOptions } from '../../../tools/types';
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

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

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
    const inputData = makeInputData();

    const executePromise = toolCallStep.execute(makeExecuteParams({ inputData }));

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

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('should handle declined tool calls without executing the tool', async () => {
    const inputData = makeInputData();
    const resumeData = { approved: false };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

    expect(result).toEqual({
      result: 'Tool call was not approved by the user',
      ...inputData,
    });
    expectNoToolExecution();
  });

  it('should return inputData as-is for provider-executed tools (no client execution)', async () => {
    // Provider-executed tools are handled by the stream path (tool-call + tool-result chunks
    // in llm-execution-step), so tool-call-step just passes through inputData unchanged.
    const inputData = {
      ...makeInputData(),
      toolName: 'web_search_20250305',
      providerExecuted: true,
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result).toEqual(inputData);
    expect(result.result).toBeUndefined();
    expectNoToolExecution();
  });

  it('executes the tool and returns result when approval is granted', async () => {
    const inputData = makeInputData();
    const toolResult = { success: true, data: 'test-result' };
    tools['test-tool'].execute.mockResolvedValue(toolResult);
    const resumeData = { approved: true };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

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

describe('createToolCallStep needsApprovalFn enriched context', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let messageList: MessageList;
  let neverResolve: Promise<never>;

  const makeInputData = () => ({
    toolCallId: 'ctx-call-id',
    toolName: 'ctx-tool',
    args: { action: 'delete' },
  });

  const makeExecuteParams = (overrides: any = {}) => ({
    ...makeBaseExecuteParams(suspend),
    writer: new ToolStream({
      prefix: 'tool',
      callId: 'ctx-call-id',
      name: 'ctx-tool',
      runId: 'ctx-run-id',
    }),
    inputData: makeInputData(),
    ...overrides,
  });

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    neverResolve = new Promise(() => {});
    suspend = vi.fn().mockReturnValue(neverResolve);
    streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    messageList = createMessageList();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should default to requiring approval when needsApprovalFn throws', async () => {
    const needsApprovalFn = vi.fn().mockImplementation(() => {
      throw new Error('approval fn error');
    });
    const tools = {
      'ctx-tool': {
        execute: vi.fn(),
        requireApproval: true,
        needsApprovalFn,
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'error-run-id',
      streamState,
    });

    const executePromise = toolCallStep.execute(makeExecuteParams());

    await new Promise(resolve => setImmediate(resolve));

    // Should still suspend (default to requiring approval on error)
    expect(suspend).toHaveBeenCalled();
    expect(tools['ctx-tool'].execute).not.toHaveBeenCalled();

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('should skip approval when needsApprovalFn returns false', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    const toolResult = { deleted: true };
    const tools = {
      'ctx-tool': {
        execute: vi.fn().mockResolvedValue(toolResult),
        requireApproval: true,
        needsApprovalFn,
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'skip-run-id',
      streamState,
    });

    const result = await toolCallStep.execute(makeExecuteParams());

    expect(needsApprovalFn).toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({
      result: toolResult,
      ...makeInputData(),
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

  it('should skip execution and return inputData as-is for provider-executed tools', async () => {
    const tools = {
      webSearch: {
        type: 'provider-defined' as const,
        id: 'openai.web_search',
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
    };

    const result = await step.execute({
      ...makeBaseExecuteParams(suspend),
      writer: new ToolStream({ prefix: 'tool', callId: 'call-123', name: 'web_search', runId: 'test-run' }),
      inputData,
    });

    expect(result).toEqual(inputData);
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

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, requestContext }));

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

    await toolCallStep.execute(makeExecuteParams({ inputData, requestContext }));

    expect(capturedOptions).toBeDefined();
    expect(capturedOptions!.requestContext).toBe(requestContext);
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
