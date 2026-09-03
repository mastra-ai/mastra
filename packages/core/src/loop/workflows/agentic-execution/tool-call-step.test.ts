import type { ToolSet } from '@internal/ai-sdk-v5';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod/v4';
import { MessageList } from '../../../agent/message-list';
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

describe('createToolCallStep background task resume with falsy payload', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const runBackgroundResume = async (resumeData: unknown) => {
    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const messageList = createMessageList();
    const backgroundTaskManager = {
      // A suspended task already exists for this tool call, so the step should
      // resume it rather than dispatch a brand new one.
      listTasks: vi.fn(async () => ({ tasks: [{ id: 'suspended-task-1' }], total: 1 })),
      resume: vi.fn(async () => ({ id: 'suspended-task-1' })),
      enqueue: vi.fn(async () => ({ task: { id: 'brand-new-task' }, fallbackToSync: false })),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
    };
    const tools = {
      'background-tool': {
        backgroundConfig: { enabled: true },
        execute: vi.fn(async () => ({ ok: true })),
      },
    } as any;

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'current-run',
      streamState,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        resumeData,
        inputData: { toolCallId: 'call-1', toolName: 'background-tool', args: { query: 'customers' } },
      }),
    );

    return backgroundTaskManager;
  };

  const runBackgroundDispatchOnResume = async (resumeData: unknown) => {
    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const messageList = createMessageList();
    const backgroundTaskManager = {
      // No suspended task, so this resume turn dispatches instead. The chunk comes
      // back on the CURRENT run id, which is the case the replay gate guards.
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
      resume: vi.fn(),
      enqueue: vi.fn(async (_payload: any, context: any) => {
        context.onChunk?.({
          type: 'background-task-completed',
          payload: {
            taskId: 'task-1',
            toolCallId: 'call-1',
            toolName: 'background-tool',
            agentId: 'agent-1',
            runId: 'current-run',
            result: { ok: true },
            completedAt: new Date(),
          },
        });
        return { task: { id: 'task-1' }, fallbackToSync: false };
      }),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
    };
    const tools = {
      'background-tool': { backgroundConfig: { enabled: true }, execute: vi.fn() },
    } as any;

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'current-run',
      streamState,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        resumeData,
        inputData: { toolCallId: 'call-1', toolName: 'background-tool', args: { query: 'customers' } },
      }),
    );

    await vi.waitFor(() => {
      expect(controller.enqueue).toHaveBeenCalled();
    });
    return controller;
  };

  it('replays the tool-call chunk on a same-run resume with a falsy payload', async () => {
    // The replay exists so a reloading UI still renders the invocation that was streamed
    // in the earlier turn. A falsy resume payload is still a resume, so it must replay.
    const controller = await runBackgroundDispatchOnResume(false);

    const replayed = controller.enqueue.mock.calls
      .map(([chunk]: [any]) => chunk)
      .filter((chunk: any) => chunk.type === 'tool-call');
    expect(replayed).toHaveLength(1);
  });

  it('records the background result to memory on a same-run resume with a falsy payload', async () => {
    // When no matching tool-invocation is on the list, the result is appended as a standalone
    // tool message so memory still records it. A falsy resume payload must not skip that.
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const added: any[] = [];
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [] },
        all: { db: () => [], aiV5: { model: () => [] } },
      },
      updateToolInvocation: vi.fn(() => false),
      updateMessageMetadataByToolCallId: vi.fn(() => true),
      add: vi.fn((messages: any) => {
        added.push(messages);
      }),
    } as unknown as MessageList;

    const backgroundTaskManager = {
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
      resume: vi.fn(),
      enqueue: vi.fn(async (_payload: any, context: any) => {
        await context.onResult?.({
          taskId: 'task-1',
          toolCallId: 'call-1',
          toolName: 'background-tool',
          runId: 'current-run',
          status: 'completed',
          result: { ok: true },
          startedAt: new Date(0),
          completedAt: new Date(0),
        });
        return { task: { id: 'task-1' }, fallbackToSync: false };
      }),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
    };

    const toolCallStep = createToolCallStep({
      tools: { 'background-tool': { backgroundConfig: { enabled: true }, execute: vi.fn() } } as any,
      messageList,
      controller: { enqueue: vi.fn() },
      runId: 'current-run',
      streamState,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        resumeData: false,
        inputData: { toolCallId: 'call-1', toolName: 'background-tool', args: { query: 'customers' } },
      }),
    );

    // Distinguish the standalone tool-CALL record (the gated fallback) from the
    // tool-RESULT message that is appended unconditionally a few lines below it.
    const callRecords = added
      .flat()
      .filter((message: any) => message?.role === 'tool')
      .filter((message: any) => (message.content ?? []).some((part: any) => part.type === 'tool-call'));
    expect(callRecords).toHaveLength(1);
  });

  it('resumes the suspended task when the resume payload is an object', async () => {
    const manager = await runBackgroundResume({ confirmed: true });

    expect(manager.resume).toHaveBeenCalledWith('suspended-task-1', { confirmed: true });
    expect(manager.enqueue).not.toHaveBeenCalled();
  });

  it.each([
    ['false', false],
    ['zero', 0],
    ['an empty string', ''],
  ])('resumes the suspended task when the resume payload is %s', async (_label, resumeData) => {
    // A primitive resumeSchema makes these valid payloads; `false` is how a boolean
    // human-in-the-loop tool declines. Treating them as "no resume data" silently
    // dispatches a second task while the first stays suspended forever.
    const manager = await runBackgroundResume(resumeData);

    expect(manager.resume).toHaveBeenCalledWith('suspended-task-1', resumeData);
    expect(manager.enqueue).not.toHaveBeenCalled();
  });
});

describe('createToolCallStep background task stream replay', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('should replay a synthetic tool-call only once per resumed background task stream', async () => {
    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const messageList = createMessageList();
    const backgroundTaskManager = {
      enqueue: vi.fn(async (_payload: any, context: any) => {
        context.onChunk?.({
          type: 'background-task-completed',
          payload: {
            taskId: 'task-1',
            toolCallId: 'call-1',
            toolName: 'background-tool',
            agentId: 'agent-1',
            runId: 'resumed-run',
            result: { first: true },
            completedAt: new Date(),
          },
        });
        context.onChunk?.({
          type: 'background-task-completed',
          payload: {
            taskId: 'task-1',
            toolCallId: 'call-1',
            toolName: 'background-tool',
            agentId: 'agent-1',
            runId: 'resumed-run',
            result: { second: true },
            completedAt: new Date(),
          },
        });

        return {
          task: { id: 'task-1' },
          fallbackToSync: false,
        };
      }),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const tools = {
      'background-tool': {
        backgroundConfig: { enabled: true },
        execute: vi.fn(),
      },
    } as any;

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'current-run',
      streamState,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: {
          toolCallId: 'call-1',
          toolName: 'background-tool',
          args: { query: 'customers' },
        },
      }),
    );
    let replayedToolCalls: any[] = [];
    await vi.waitFor(() => {
      replayedToolCalls = controller.enqueue.mock.calls
        .map(([chunk]) => chunk)
        .filter(chunk => chunk.type === 'tool-call');
      expect(replayedToolCalls).toHaveLength(1);
    });

    expect(replayedToolCalls).toHaveLength(1);
    expect(replayedToolCalls[0]).toMatchObject({
      type: 'tool-call',
      runId: 'resumed-run',
      payload: {
        toolCallId: 'call-1',
        toolName: 'background-tool',
        args: { query: 'customers' },
      },
    });
  });

  it('awaits the exact background task until its authoritative result is reconciled', async () => {
    const order: string[] = [];
    const controller = { enqueue: vi.fn() };
    const flushMessages = vi.fn(async () => {
      order.push('flushed');
    });
    const messageList = {
      ...createMessageList(),
      updateToolInvocation: vi.fn(() => {
        order.push('reconciled');
        return true;
      }),
      updateMessageMetadataByToolCallId: vi.fn(),
    } as unknown as MessageList;
    let completeTask!: () => void;
    const taskCompleted = new Promise<void>(resolve => {
      completeTask = resolve;
    });
    const backgroundTaskManager = {
      enqueue: vi.fn(async (_payload: any, context: any) => {
        void (async () => {
          await context.onResult({
            status: 'completed',
            taskId: 'task-awaited',
            toolCallId: 'call-awaited',
            toolName: 'background-tool',
            agentId: 'agent-1',
            runId: 'current-run',
            result: { answer: 42 },
            startedAt: new Date(),
            completedAt: new Date(),
          });
          order.push('terminal');
          completeTask();
        })();
        return { task: { id: 'task-awaited' }, fallbackToSync: false };
      }),
      waitForNextTask: vi.fn(async () => {
        await taskCompleted;
        return { id: 'task-awaited', status: 'completed', result: { answer: 42 } };
      }),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const tools = {
      'background-tool': {
        backgroundConfig: { enabled: true },
        execute: vi.fn(),
      },
    } as any;

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'current-run',
      streamState: { serialize: vi.fn() },
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
        saveQueueManager: { flushMessages },
        threadId: 'thread-1',
      },
    } as any);

    const result = await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: {
          toolCallId: 'call-awaited',
          toolName: 'background-tool',
          args: { query: 'meaning', _background: { disposition: 'awaited' } },
        },
      }),
    );

    expect(result).toMatchObject({ result: { answer: 42 } });
    expect(backgroundTaskManager.waitForNextTask).toHaveBeenCalledWith(['task-awaited'], undefined);
    expect(order).toEqual(['reconciled', 'flushed', 'terminal']);
    expect(tools['background-tool'].execute).not.toHaveBeenCalled();
  });

  it('awaits failed background work until the failure is reconciled', async () => {
    const order: string[] = [];
    const messageList = {
      ...createMessageList(),
      updateToolInvocation: vi.fn(() => {
        order.push('reconciled');
        return true;
      }),
      updateMessageMetadataByToolCallId: vi.fn(),
    } as unknown as MessageList;
    let completeTask!: () => void;
    const taskCompleted = new Promise<void>(resolve => {
      completeTask = resolve;
    });
    const backgroundTaskManager = {
      enqueue: vi.fn(async (_payload: any, context: any) => {
        void (async () => {
          await context.onResult({
            status: 'failed',
            taskId: 'task-failed',
            toolCallId: 'call-failed',
            toolName: 'background-tool',
            agentId: 'agent-1',
            runId: 'current-run',
            error: { message: 'lookup failed' },
            startedAt: new Date(),
            completedAt: new Date(),
          });
          order.push('terminal');
          completeTask();
        })();
        return { task: { id: 'task-failed' }, fallbackToSync: false };
      }),
      waitForNextTask: vi.fn(async () => {
        await taskCompleted;
        return { id: 'task-failed', status: 'failed', error: { message: 'lookup failed' } };
      }),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': { backgroundConfig: { enabled: true }, execute: vi.fn() },
      } as any,
      messageList,
      controller: { enqueue: vi.fn() },
      runId: 'current-run',
      streamState: { serialize: vi.fn() },
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    const result = await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: {
          toolCallId: 'call-failed',
          toolName: 'background-tool',
          args: { query: 'missing', _background: { disposition: 'awaited' } },
        },
      }),
    );

    expect(result as any).toMatchObject({ error: expect.objectContaining({ message: 'lookup failed' }) });
    expect(order).toEqual(['reconciled', 'terminal']);
  });
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
    // The step output crosses the evented engine's pubsub boundary where Error instances
    // would serialize to `{}`, so the step returns a plain {name,message,stack} shape that
    // the consumer (`llm-mapping-step`) reifies back into an Error via `deserializeToolError`.
    expect(result.error).toMatchObject({
      name: 'Error',
      message: expect.stringContaining('External API error: 503 Service Unavailable'),
    });
  });

  it('should return aborted (not error/result) when the request was aborted while the tool threw', async () => {
    // A throw caused by request cancellation must NOT become a tool result, or the call is
    // persisted as completed (result = abort message) and reads as success on resume. The
    // step flags it `aborted` instead. CoreToolBuilder wraps the throw in a MastraError, so
    // the abort signal — not the error type — is the evidence.
    const abortedTool = createTool({
      id: 'failing-tool',
      description: 'A tool that throws when the request is cancelled',
      inputSchema: z.object({ param: z.string() }),
      execute: async () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        throw err;
      },
    });

    const builtTool = new CoreToolBuilder({
      originalTool: abortedTool,
      options: {
        name: 'failing-tool',
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
        description: 'A tool that throws when the request is cancelled',
        requestContext: new RequestContext(),
      },
    }).build();

    const abortController = new AbortController();
    abortController.abort();

    const toolCallStep = createToolCallStep({
      tools: { 'failing-tool': builtTool },
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      // The agent-run abort signal (req.signal in production) is wired in via `options`.
      options: { abortSignal: abortController.signal },
    } as any);

    const result = await toolCallStep.execute(makeExecuteParams({ inputData: makeInputData() }));

    expect(result).toHaveProperty('aborted', true);
    expect(result).not.toHaveProperty('error');
    expect(result).not.toHaveProperty('result');
  });

  it('should still return error (not aborted) when a tool throws and the request was NOT aborted', async () => {
    // Guard against over-reach: a genuine tool failure on a live request must keep surfacing
    // as an error result so the model can see it and self-correct.
    const failingTool = createTool({
      id: 'failing-tool',
      description: 'A tool that throws',
      inputSchema: z.object({ param: z.string() }),
      execute: async () => {
        throw new Error('External API error: 503 Service Unavailable');
      },
    });

    const builtTool = new CoreToolBuilder({
      originalTool: failingTool,
      options: {
        name: 'failing-tool',
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
        description: 'A tool that throws',
        requestContext: new RequestContext(),
      },
    }).build();

    const toolCallStep = createToolCallStep({
      tools: { 'failing-tool': builtTool },
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);

    // Fresh (non-aborted) signal
    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData: makeInputData(), abortSignal: new AbortController().signal }),
    );

    expect(result).toHaveProperty('error');
    expect(result).not.toHaveProperty('aborted');
    expect(result).not.toHaveProperty('result');
  });
});

describe('createToolCallStep tool-level FGA delegation', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // Tool FGA is enforced by the tool wrapper (builder.ts), not by tool-call-step
  // itself, so regular and durable paths authorize the same canonical id. This
  // guards that tool-call-step does not run its own (bare-id) check and still
  // forwards the actor to the wrapped tool.
  it('does not call the FGA provider directly and forwards the actor to the tool', async () => {
    const controller = { enqueue: vi.fn() };
    const suspend = vi.fn();
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const messageList = createMessageList();
    const toolResult = { ok: true };
    const tools = {
      'system-tool': {
        execute: vi.fn().mockResolvedValue(toolResult),
      },
    };
    const fgaProvider = {
      require: vi.fn().mockResolvedValue(undefined),
      check: vi.fn(),
      filterAccessible: vi.fn(),
    };
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'system-run-id',
      streamState,
      mastra: {
        getServer: () => ({ fga: fgaProvider }),
      },
      actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
    } as any);

    const result = await toolCallStep.execute(
      makeBaseExecuteParams(suspend, {
        requestContext,
        writer: new ToolStream({
          prefix: 'tool',
          callId: 'system-call-id',
          name: 'system-tool',
          runId: 'system-run-id',
        }),
        inputData: {
          toolCallId: 'system-call-id',
          toolName: 'system-tool',
          args: { value: 'test' },
        },
      }),
    );

    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(tools['system-tool'].execute).toHaveBeenCalledWith(
      { value: 'test' },
      expect.objectContaining({
        toolCallId: 'system-call-id',
        actor: { actorKind: 'system', sourceWorkflow: 'nightly-workflow' },
      }),
    );
    expect(result).toEqual({
      result: toolResult,
      toolCallId: 'system-call-id',
      toolName: 'system-tool',
      args: { value: 'test' },
    });
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
    await new Promise(resolve => setImmediate(resolve));

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

  it.each([{}, { approved: 'true' }])('re-suspends malformed workflow approval data: %j', async resumeData => {
    suspend.mockResolvedValueOnce('suspended');

    const result = await toolCallStep.execute(makeExecuteParams({ resumeData }));

    expect(result).toBe('suspended');
    expect(suspend).toHaveBeenCalledTimes(1);
    expectNoToolExecution();
  });

  it('does not accept model-authored approval data', async () => {
    suspend.mockResolvedValueOnce('suspended');
    const inputData = makeInputData();

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData: { ...inputData, args: { ...inputData.args, resumeData: { approved: true } } },
      }),
    );

    expect(result).toBe('suspended');
    expect(suspend).toHaveBeenCalledTimes(1);
    expectNoToolExecution();
  });

  it('should not flush messages before suspending when memory is read-only', async () => {
    const flushMessages = vi.fn().mockResolvedValue(undefined);
    const readOnlyStep = createToolCallStep({
      tools,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        memoryConfig: { readOnly: true },
        threadId: 'read-only-thread',
        threadExists: true,
      },
    } as any);

    suspend.mockResolvedValueOnce('completed');
    const executePromise = readOnlyStep.execute(makeExecuteParams());
    await new Promise(resolve => setImmediate(resolve));

    expect(suspend).toHaveBeenCalled();
    expect(flushMessages).not.toHaveBeenCalled();
    await expect(executePromise).resolves.toBe('completed');
  });

  it('should handle declined tool calls without executing the tool', async () => {
    const inputData = makeInputData();
    const resumeData = { approved: false };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

    // A declined approval returns the decision (not a `result` string) so it persists as
    // `output-denied` with the approval object; the reason carries the existing message.
    expect(result).toEqual({
      approval: {
        id: inputData.toolCallId,
        approved: false,
        reason: 'Tool call was not approved by the user',
      },
      ...inputData,
    });
    expectNoToolExecution();
  });

  it('carries a caller-supplied decline reason onto the approval decision (#20495)', async () => {
    const inputData = makeInputData();
    const resumeData = { approved: false, reason: 'The user is not authorized to read this file' };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

    expect(result).toEqual({
      approval: {
        id: inputData.toolCallId,
        approved: false,
        reason: 'The user is not authorized to read this file',
      },
      ...inputData,
    });
    expectNoToolExecution();
  });

  it('falls back to the default decline reason when the supplied reason is blank (#20495)', async () => {
    const inputData = makeInputData();

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData: { approved: false, reason: '   ' } }),
    );

    expect((result as any).approval.reason).toBe('Tool call was not approved by the user');
    expectNoToolExecution();
  });

  it('advertises an optional reason on the approval resume schema (#20495)', async () => {
    suspend.mockResolvedValueOnce('suspended');
    await toolCallStep.execute(makeExecuteParams());

    const approvalChunk = controller.enqueue.mock.calls
      .map(([chunk]: [any]) => chunk)
      .find((chunk: any) => chunk?.type === 'tool-call-approval');
    expect(approvalChunk).toBeDefined();
    const resumeSchema = JSON.parse(approvalChunk.payload.resumeSchema);
    expect(resumeSchema.properties.reason).toBeDefined();
    expect(resumeSchema.required).toEqual(['approved']);
  });

  it('declines without a live requireToolApproval policy when suspendData marks approval (#20470)', async () => {
    // Mirrors declineToolCall after agent-level requireToolApproval (boolean/function) gated
    // the original suspend: resume helpers do not re-pass the policy, and function policies
    // do not survive RequestContext serialization. The suspend payload still records the wait.
    const inputData = makeInputData();
    const toolsWithoutFlag = {
      'test-tool': {
        execute: vi.fn().mockResolvedValue({ leaked: true }),
      },
    };
    const step = createToolCallStep({
      tools: toolsWithoutFlag,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      // intentionally no requireToolApproval — lost on resume
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: false },
        suspendData: {
          requireToolApproval: {
            toolCallId: inputData.toolCallId,
            toolName: inputData.toolName,
            args: inputData.args,
          },
        },
      }),
    );

    expect(result).toEqual({
      approval: {
        id: inputData.toolCallId,
        approved: false,
        reason: 'Tool call was not approved by the user',
      },
      ...inputData,
    });
    expect(toolsWithoutFlag['test-tool'].execute).not.toHaveBeenCalled();
  });

  it('approves exactly once when live policy is gone but suspendData marks approval', async () => {
    const inputData = makeInputData();
    const toolResult = { success: true };
    const toolsWithoutFlag = {
      'test-tool': {
        execute: vi.fn().mockResolvedValue(toolResult),
      },
    };
    const step = createToolCallStep({
      tools: toolsWithoutFlag,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    });

    const result = await step.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true },
        suspendData: {
          requireToolApproval: {
            toolCallId: inputData.toolCallId,
            toolName: inputData.toolName,
            args: inputData.args,
          },
        },
      }),
    );

    expect(toolsWithoutFlag['test-tool'].execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      result: toolResult,
      ...inputData,
      approval: {
        id: inputData.toolCallId,
        approved: true,
      },
    });
  });

  it('does not outer-gate decline when suspendData has suspendedToolRunId (delegated approval)', async () => {
    // Nested sub-agent/workflow approval suspends also write requireToolApproval on the
    // outer payload, but they set suspendedToolRunId. Decline must reach the nested tool
    // (resumeData forwarded), not the outer output-denied short-circuit.
    const inputData = makeInputData();
    const toolsWithoutFlag = {
      'test-tool': {
        execute: vi.fn().mockResolvedValue({ forwarded: true }),
      },
    };
    const step = createToolCallStep({
      tools: toolsWithoutFlag,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    });

    const resumeData = { approved: false };
    const result = await step.execute(
      makeExecuteParams({
        inputData,
        resumeData,
        suspendData: {
          requireToolApproval: {
            toolCallId: inputData.toolCallId,
            toolName: inputData.toolName,
            args: inputData.args,
          },
          suspendedToolRunId: 'nested-run-id',
        },
      }),
    );

    expect(result).toEqual({
      result: { forwarded: true },
      ...inputData,
    });
    expect(toolsWithoutFlag['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        toolCallId: inputData.toolCallId,
        resumeData,
      }),
    );
  });

  it('forwards delegated decline even when a live requireToolApproval policy is present', async () => {
    // Live outer policy must not re-gate nested resumes: with requireToolApproval still
    // set, suspendedToolRunId + { approved: false } must reach the nested tool.
    const inputData = makeInputData();
    const toolsWithoutFlag = {
      'test-tool': {
        execute: vi.fn().mockResolvedValue({ forwarded: true }),
      },
    };
    const step = createToolCallStep({
      tools: toolsWithoutFlag,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
    });

    const resumeData = { approved: false };
    const result = await step.execute(
      makeExecuteParams({
        inputData,
        resumeData,
        suspendData: {
          requireToolApproval: {
            toolCallId: inputData.toolCallId,
            toolName: inputData.toolName,
            args: inputData.args,
          },
          suspendedToolRunId: 'nested-run-id',
        },
      }),
    );

    expect(result).toEqual({
      result: { forwarded: true },
      ...inputData,
    });
    expect(toolsWithoutFlag['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        toolCallId: inputData.toolCallId,
        resumeData,
      }),
    );
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
    // An approved approval-gated tool tags its result with the approval grant so it
    // round-trips on recall as `approval: { approved: true }`.
    expect(result).toEqual({
      result: toolResult,
      ...inputData,
      approval: {
        id: inputData.toolCallId,
        approved: true,
      },
    });
  });
});

describe('createToolCallStep delegated agent tool metadata', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let neverResolve: Promise<never>;

  const createAssistantMessage = (
    id: string,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ) => ({
    id,
    role: 'assistant' as const,
    createdAt: new Date(0),
    content: {
      format: 2 as const,
      metadata: {} as Record<string, unknown>,
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocation: {
            state: 'call' as const,
            toolCallId,
            toolName,
            args,
          },
        },
      ],
    },
  });

  const startDelegatedTool = ({
    messageList,
    requireApproval,
    suspendPayload = {},
    logger,
    toolCallId = 'parent-tool-call-id',
    delegatedRunId = 'sub-agent-run-id',
    toolPayloadTransform,
  }: {
    messageList: MessageList;
    requireApproval: boolean;
    suspendPayload?: unknown;
    logger?: { warn: Mock; debug?: Mock };
    toolCallId?: string;
    delegatedRunId?: string;
    toolPayloadTransform?: unknown;
  }) => {
    const tools = {
      'agent-subAgent': {
        execute: vi.fn(async (_args: unknown, opts: MastraToolInvocationOptions) => {
          await opts.suspend?.(suspendPayload, {
            ...(requireApproval ? { requireToolApproval: true } : {}),
            runId: delegatedRunId,
          });
          return { text: 'done' };
        }),
      },
    } as ToolSet;
    const inputData = {
      toolCallId,
      toolName: 'agent-subAgent',
      args: { prompt: 'do thing' },
    };
    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'parent-run-id',
      streamState,
      logger: logger as any,
      _internal: toolPayloadTransform ? ({ toolPayloadTransform } as any) : undefined,
    });

    return toolCallStep.execute({
      ...makeBaseExecuteParams(suspend),
      writer: new ToolStream({
        prefix: 'tool',
        callId: inputData.toolCallId,
        name: inputData.toolName,
        runId: 'parent-run-id',
      }),
      inputData,
    });
  };

  const settleToolSuspension = async () => {
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setImmediate(resolve));
    }
  };

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    neverResolve = new Promise(() => {});
    suspend = vi.fn().mockReturnValue(neverResolve);
    streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('stores the outer resumable runId with delegatedRunId when a nested agent run requests tool approval', async () => {
    const assistantMessage = createAssistantMessage('assistant-target', 'parent-tool-call-id', 'agent-subAgent', {
      prompt: 'do thing',
    });
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [assistantMessage] },
        all: { db: () => [assistantMessage], aiV5: { model: () => [] } },
      },
    } as unknown as MessageList;

    const executePromise = startDelegatedTool({ messageList, requireApproval: true });
    await settleToolSuspension();

    const pending = (assistantMessage.content.metadata as Record<string, any>).pendingToolApprovals?.[
      'parent-tool-call-id'
    ];
    // `runId` is the outer resumable run (valid `resumeStream` target after
    // refresh/restart); the inner suspended run is kept as `delegatedRunId`.
    // Channel resume reads `parentRunId ?? runId`, so no `parentRunId` is needed.
    expect(pending).toMatchObject({
      toolCallId: 'parent-tool-call-id',
      runId: 'parent-run-id',
      delegatedRunId: 'sub-agent-run-id',
    });
    expect(pending.parentRunId).toBeUndefined();

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('advertises an optional reason on the delegated approval resume schema (#20495)', async () => {
    const assistantMessage = createAssistantMessage('assistant-target', 'parent-tool-call-id', 'agent-subAgent', {
      prompt: 'do thing',
    });
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [assistantMessage] },
        all: { db: () => [assistantMessage], aiV5: { model: () => [] } },
      },
    } as unknown as MessageList;

    const executePromise = startDelegatedTool({ messageList, requireApproval: true });
    await settleToolSuspension();

    const approvalChunk = controller.enqueue.mock.calls
      .map(([chunk]: [any]) => chunk)
      .find((chunk: any) => chunk?.type === 'tool-call-approval');
    expect(approvalChunk).toBeDefined();
    const resumeSchema = JSON.parse(approvalChunk.payload.resumeSchema);
    expect(resumeSchema.properties.reason).toBeDefined();
    expect(resumeSchema.required).toEqual(['approved']);

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('preserves explicitly transformed null payloads in approval and suspension metadata', async () => {
    const toolPayloadTransform = {
      targets: ['transcript'],
      transformToolPayload: vi.fn(() => null),
    };
    const approvalMessage = createAssistantMessage('assistant-approval', 'parent-tool-call-id', 'agent-subAgent', {
      secret: 'approval-secret',
    });
    const approvalMessageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [approvalMessage] },
        all: { db: () => [approvalMessage], aiV5: { model: () => [] } },
      },
    } as unknown as MessageList;

    const approvalExecution = startDelegatedTool({
      messageList: approvalMessageList,
      requireApproval: true,
      toolPayloadTransform,
    });
    await settleToolSuspension();
    expect(
      (approvalMessage.content.metadata as Record<string, any>).pendingToolApprovals['parent-tool-call-id'].args,
    ).toBeNull();

    const suspensionMessage = createAssistantMessage('assistant-suspension', 'parent-tool-call-id', 'agent-subAgent', {
      secret: 'suspension-secret',
    });
    const suspensionMessageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [suspensionMessage] },
        all: { db: () => [suspensionMessage], aiV5: { model: () => [] } },
      },
    } as unknown as MessageList;

    const suspensionExecution = startDelegatedTool({
      messageList: suspensionMessageList,
      requireApproval: false,
      suspendPayload: { secret: 'suspend-payload-secret' },
      toolPayloadTransform,
    });
    await settleToolSuspension();
    const suspendedEntry = (suspensionMessage.content.metadata as Record<string, any>).suspendedTools[
      'parent-tool-call-id'
    ];
    expect(suspendedEntry.args).toBeNull();
    expect(suspendedEntry.suspendPayload).toBeNull();

    await expect(Promise.race([approvalExecution, Promise.resolve('completed')])).resolves.toBe('completed');
    await expect(Promise.race([suspensionExecution, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('recovers a drained response message when persisting a delegated tool suspension', async () => {
    const targetMessage = createAssistantMessage('assistant-target', 'parent-tool-call-id', 'agent-subAgent', {
      prompt: 'do thing',
    });
    const unrelatedMessage = createAssistantMessage('assistant-unrelated', 'unrelated-tool-call-id', 'unrelatedTool');
    const messageList = new MessageList();
    messageList.add(targetMessage, 'response');
    messageList.drainUnsavedMessages();
    messageList.add({ role: 'user', content: 'next turn' }, 'input');
    messageList.add(unrelatedMessage, 'response');
    const updateMessageMetadataByToolCallId = vi.spyOn(messageList, 'updateMessageMetadataByToolCallId');

    const executePromise = startDelegatedTool({
      messageList,
      requireApproval: false,
      suspendPayload: { reason: 'review' },
    });
    await settleToolSuspension();

    expect(updateMessageMetadataByToolCallId).toHaveBeenCalledWith(
      'parent-tool-call-id',
      expect.objectContaining({
        suspendedTools: expect.objectContaining({
          'parent-tool-call-id': expect.objectContaining({
            runId: 'parent-run-id',
            delegatedRunId: 'sub-agent-run-id',
            suspendPayload: { reason: 'review' },
          }),
        }),
      }),
    );
    expect(unrelatedMessage.content.metadata).toEqual({});
    expect((targetMessage.content.metadata as Record<string, any>).suspendedTools).toHaveProperty(
      'parent-tool-call-id',
    );

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('persists BOTH siblings when the shared response is drained before each metadata write', async () => {
    // Two parallel delegations to the same sub-agent share one assistant message. Flush the
    // response before EACH sibling's metadata write so both take the drained-message fallback;
    // the second fallback merge must preserve the first sibling's already-persisted entry.
    const targetMessage = createAssistantMessage('assistant-target', 'tool-call-A', 'agent-subAgent', {
      prompt: 'do thing',
    });
    targetMessage.content.parts.push({
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'call' as const,
        toolCallId: 'tool-call-B',
        toolName: 'agent-subAgent',
        args: { prompt: 'do other thing' },
      },
    });
    const messageList = new MessageList();
    messageList.add(targetMessage, 'response');
    messageList.drainUnsavedMessages();

    const executeA = startDelegatedTool({
      messageList,
      requireApproval: false,
      suspendPayload: { reason: 'review-A' },
      toolCallId: 'tool-call-A',
      delegatedRunId: 'sub-agent-run-A',
    });
    await settleToolSuspension();
    // A's fallback re-queued the message; flush again so B also finds a drained response view.
    messageList.drainUnsavedMessages();

    const executeB = startDelegatedTool({
      messageList,
      requireApproval: false,
      suspendPayload: { reason: 'review-B' },
      toolCallId: 'tool-call-B',
      delegatedRunId: 'sub-agent-run-B',
    });
    await settleToolSuspension();

    const suspendedTools = (targetMessage.content.metadata as Record<string, any>).suspendedTools ?? {};
    expect(Object.keys(suspendedTools).sort()).toEqual(['tool-call-A', 'tool-call-B']);
    expect(suspendedTools['tool-call-A']).toMatchObject({
      runId: 'parent-run-id',
      delegatedRunId: 'sub-agent-run-A',
      suspendPayload: { reason: 'review-A' },
    });
    expect(suspendedTools['tool-call-B']).toMatchObject({
      runId: 'parent-run-id',
      delegatedRunId: 'sub-agent-run-B',
      suspendPayload: { reason: 'review-B' },
    });
    // The recovered message must be queued for persistence again.
    expect(messageList.get.response.db()).toContain(targetMessage);

    await expect(Promise.race([executeA, Promise.resolve('completed')])).resolves.toBe('completed');
    await expect(Promise.race([executeB, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('logs at debug when a drained response message cannot be marked unsaved', async () => {
    const targetMessage = createAssistantMessage('assistant-target', 'parent-tool-call-id', 'agent-subAgent', {
      prompt: 'do thing',
    });
    const unrelatedMessage = createAssistantMessage('assistant-unrelated', 'unrelated-tool-call-id', 'unrelatedTool');
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [unrelatedMessage] },
        all: { db: () => [targetMessage, unrelatedMessage], aiV5: { model: () => [] } },
      },
      updateMessageMetadataByToolCallId: vi.fn().mockReturnValue(false),
    } as unknown as MessageList;

    const executePromise = startDelegatedTool({
      messageList,
      requireApproval: false,
      suspendPayload: { reason: 'review' },
      logger,
    });
    await settleToolSuspension();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('could not update the assistant message for tool call parent-tool-call-id'),
    );

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });
});

describe('createToolCallStep suspension metadata cleanup on resume', () => {
  let controller: { enqueue: Mock };
  let streamState: { serialize: Mock };

  const createSuspendedAssistantMessage = (toolCallId: string, toolName: string) => ({
    id: 'assistant-suspended',
    role: 'assistant' as const,
    createdAt: new Date(0),
    content: {
      format: 2 as const,
      metadata: {
        suspendedTools: {
          [toolCallId]: { toolCallId, toolName, runId: 'parent-run-id' },
        },
      } as Record<string, unknown>,
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocation: { state: 'call' as const, toolCallId, toolName, args: {} },
        },
      ],
    },
  });

  const runResumedTool = async ({
    resumeData,
    args,
    message,
    flushMessages,
    suspendData,
    toolCallId = 'hitl-call-id',
  }: {
    resumeData?: unknown;
    args: Record<string, unknown>;
    message: ReturnType<typeof createSuspendedAssistantMessage>;
    flushMessages: Mock;
    suspendData?: unknown;
    toolCallId?: string;
  }) => {
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [message] },
        all: { db: () => [message], aiV5: { model: () => [] } },
      },
    } as unknown as MessageList;

    const tools = {
      'hitl-tool': {
        execute: vi.fn(async () => ({ confirmed: true })),
      },
    } as ToolSet;

    const inputData = { toolCallId, toolName: 'hitl-tool', args };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'parent-run-id',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        threadId: 'thread-1',
      },
    } as any);

    return toolCallStep.execute({
      ...makeBaseExecuteParams(vi.fn(), { resumeData, suspendData }),
      writer: new ToolStream({
        prefix: 'tool',
        callId: inputData.toolCallId,
        name: inputData.toolName,
        runId: 'parent-run-id',
      }),
      inputData,
    });
  };

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('clears suspendedTools when resumed via workflow resumeData (agent.resumeStream)', async () => {
    // `agent.resumeStream(resumeData, { runId, toolCallId })` delivers the payload as the step's
    // workflow resumeData, NOT embedded in the LLM's args. The suspension entry must still be
    // cleared, or a reloading client reads the resolved tool as still resumable.
    const message = createSuspendedAssistantMessage('hitl-call-id', 'hitl-tool');
    const flushMessages = vi.fn();

    await runResumedTool({
      resumeData: { confirmed: true },
      args: { prompt: 'do thing' },
      message,
      flushMessages,
    });

    expect(message.content.metadata.suspendedTools).toBeUndefined();
    expect(flushMessages).toHaveBeenCalled();
  });

  it('clears suspendedTools when resumed via resumeData embedded in args', async () => {
    const message = createSuspendedAssistantMessage('hitl-call-id', 'hitl-tool');
    const flushMessages = vi.fn();

    await runResumedTool({
      args: { prompt: 'do thing', resumeData: { confirmed: true } },
      message,
      flushMessages,
    });

    expect(message.content.metadata.suspendedTools).toBeUndefined();
    expect(flushMessages).toHaveBeenCalled();
  });

  it.each([
    ['false', false],
    ['zero', 0],
    ['an empty string', ''],
  ])('clears suspendedTools when the resume payload is %s', async (_label, resumeData) => {
    // A tool with a primitive resumeSchema can legitimately be resumed with a falsy value —
    // `false` is how a boolean HITL tool declines. A truthiness gate would skip cleanup here.
    const message = createSuspendedAssistantMessage('hitl-call-id', 'hitl-tool');
    const flushMessages = vi.fn();

    await runResumedTool({ resumeData, args: { prompt: 'do thing' }, message, flushMessages });

    expect(message.content.metadata.suspendedTools).toBeUndefined();
    expect(flushMessages).toHaveBeenCalled();
  });

  it('leaves a same-name sibling suspended when an approval resume arrives after policy loss', async () => {
    // Approve-after-policy-loss (#20470): the live `requireToolApproval` policy is gone, but the
    // suspension was an approval one, so `approvalGated` is still true and the approval branch
    // clears its own metadata. The generic suspension cleanup must not also run here —
    // `removeToolMetadata` falls back from toolCallId to toolName, so it would delete the entry
    // belonging to a different, still-suspended call of the same tool.
    const message = createSuspendedAssistantMessage('sibling-call-id', 'hitl-tool');
    const flushMessages = vi.fn();

    await runResumedTool({
      toolCallId: 'approved-call-id',
      resumeData: { approved: true },
      suspendData: { requireToolApproval: true },
      args: { prompt: 'do thing' },
      message,
      flushMessages,
    });

    expect(message.content.metadata.suspendedTools).toHaveProperty('sibling-call-id');
  });

  it('still recovers the delegated runId when a workflow tool is resumed with a falsy payload', async () => {
    // The suspension entry carries the sub-run id a delegated tool must resume into. The lookup
    // that reads it has to run for falsy resume payloads too, because the cleanup below then
    // removes the entry: skipping it would silently start a fresh sub-run instead.
    const message = {
      id: 'assistant-suspended',
      role: 'assistant' as const,
      createdAt: new Date(0),
      content: {
        format: 2 as const,
        metadata: {
          suspendedTools: {
            'wf-call-id': {
              toolCallId: 'wf-call-id',
              toolName: 'workflow-sub',
              runId: 'parent-run-id',
              delegatedRunId: 'sub-run-id',
            },
          },
        } as Record<string, unknown>,
        parts: [
          {
            type: 'tool-invocation' as const,
            toolInvocation: {
              state: 'call' as const,
              toolCallId: 'wf-call-id',
              toolName: 'workflow-sub',
              args: {},
            },
          },
        ],
      },
    };
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [message] },
        all: { db: () => [message], aiV5: { model: () => [] } },
      },
    } as unknown as MessageList;
    const execute = vi.fn(async () => ({ done: true }));

    const toolCallStep = createToolCallStep({
      tools: { 'workflow-sub': { execute } } as ToolSet,
      messageList,
      controller,
      runId: 'parent-run-id',
      streamState,
      _internal: { saveQueueManager: { flushMessages: vi.fn() }, threadId: 'thread-1' },
    } as any);

    await toolCallStep.execute({
      ...makeBaseExecuteParams(vi.fn()),
      writer: new ToolStream({ prefix: 'tool', callId: 'wf-call-id', name: 'workflow-sub', runId: 'parent-run-id' }),
      inputData: { toolCallId: 'wf-call-id', toolName: 'workflow-sub', args: { resumeData: false } },
    });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ suspendedToolRunId: 'sub-run-id' }),
      expect.objectContaining({ resumeData: false }),
    );
  });

  it('leaves suspendedTools intact for a plain (non-resume) tool call', async () => {
    const message = createSuspendedAssistantMessage('other-call-id', 'other-tool');
    const flushMessages = vi.fn();

    await runResumedTool({ args: { prompt: 'do thing' }, message, flushMessages });

    expect(message.content.metadata.suspendedTools).toHaveProperty('other-call-id');
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

describe('createToolCallStep global requireToolApproval function', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;
  let streamState: { serialize: Mock };
  let messageList: MessageList;
  let neverResolve: Promise<never>;

  const makeInputData = () => ({
    toolCallId: 'global-call-id',
    toolName: 'transfer-funds',
    args: { amount: 500 },
  });

  const makeExecuteParams = (requireToolApproval: unknown, overrides: any = {}) => {
    const requestContext = new RequestContext();
    if (requireToolApproval !== undefined) {
      requestContext.set('__mastra_requireToolApproval', requireToolApproval as any);
    }
    return {
      ...makeBaseExecuteParams(suspend, { requestContext }),
      writer: new ToolStream({
        prefix: 'tool',
        callId: 'global-call-id',
        name: 'transfer-funds',
        runId: 'global-run-id',
      }),
      inputData: makeInputData(),
      ...overrides,
    };
  };

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

  it('should require approval when the global function returns true', async () => {
    const requireToolApproval = vi.fn().mockReturnValue(true);
    const tools = { 'transfer-funds': { execute: vi.fn() } };

    const toolCallStep = createToolCallStep({ tools, messageList, controller, runId: 'global-run-id', streamState });
    const executePromise = toolCallStep.execute(makeExecuteParams(requireToolApproval));
    await new Promise(resolve => setImmediate(resolve));

    // The policy is evaluated with the tool name and args.
    expect(requireToolApproval).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'transfer-funds', args: { amount: 500 } }),
    );
    expect(suspend).toHaveBeenCalled();
    expect(tools['transfer-funds'].execute).not.toHaveBeenCalled();

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('should skip approval when the global function returns false', async () => {
    const requireToolApproval = vi.fn().mockReturnValue(false);
    const toolResult = { transferred: true };
    const tools = { 'transfer-funds': { execute: vi.fn().mockResolvedValue(toolResult) } };

    const toolCallStep = createToolCallStep({ tools, messageList, controller, runId: 'global-run-id', streamState });
    const result = await toolCallStep.execute(makeExecuteParams(requireToolApproval));

    expect(requireToolApproval).toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({ result: toolResult, ...makeInputData() });
  });

  it('should default to requiring approval when the global function throws', async () => {
    const requireToolApproval = vi.fn().mockImplementation(() => {
      throw new Error('policy error');
    });
    const tools = { 'transfer-funds': { execute: vi.fn() } };

    const toolCallStep = createToolCallStep({ tools, messageList, controller, runId: 'global-run-id', streamState });
    const executePromise = toolCallStep.execute(makeExecuteParams(requireToolApproval));
    await new Promise(resolve => setImmediate(resolve));

    expect(suspend).toHaveBeenCalled();
    expect(tools['transfer-funds'].execute).not.toHaveBeenCalled();

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('lets a per-tool needsApprovalFn override a global function that requires approval', async () => {
    // Global policy requires approval, but the tool's needsApprovalFn returns false. The
    // per-tool function is authoritative (long-standing precedence), so the call runs without
    // approval — the global must not be able to force approval on a tool that opts out.
    const requireToolApproval = vi.fn().mockReturnValue(true);
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    const toolResult = { transferred: true };
    const tools = { 'transfer-funds': { execute: vi.fn().mockResolvedValue(toolResult), needsApprovalFn } };

    const toolCallStep = createToolCallStep({ tools, messageList, controller, runId: 'global-run-id', streamState });
    const result = await toolCallStep.execute(makeExecuteParams(requireToolApproval));

    expect(needsApprovalFn).toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({ result: toolResult, ...makeInputData() });
  });

  it('lets a per-tool needsApprovalFn require approval the global function allowed', async () => {
    // Global policy allows the call, but the tool's needsApprovalFn requires approval.
    const requireToolApproval = vi.fn().mockReturnValue(false);
    const needsApprovalFn = vi.fn().mockReturnValue(true);
    const tools = { 'transfer-funds': { execute: vi.fn(), needsApprovalFn } };

    const toolCallStep = createToolCallStep({ tools, messageList, controller, runId: 'global-run-id', streamState });
    const executePromise = toolCallStep.execute(makeExecuteParams(requireToolApproval));
    await new Promise(resolve => setImmediate(resolve));

    expect(needsApprovalFn).toHaveBeenCalled();
    expect(suspend).toHaveBeenCalled();
    expect(tools['transfer-funds'].execute).not.toHaveBeenCalled();

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
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
    expect(capturedOptions).not.toHaveProperty('observe');
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
