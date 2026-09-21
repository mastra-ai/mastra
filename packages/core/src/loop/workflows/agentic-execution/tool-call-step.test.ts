import type { ToolSet } from '@internal/ai-sdk-v5';
import { jsonSchema } from '@internal/ai-v6';
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod/v4';
import { MessageList } from '../../../agent/message-list';
import { createToolCallIdentityDigest } from '../../../agent/tool-call-identity';
import {
  ON_BEFORE_TOOL_EXECUTION_KEY,
  ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY,
  TOOL_PERMISSION_DENIED_ERROR_NAME,
} from '../../../agent/tool-permission-prefilter';
import { RequestContext } from '../../../request-context';
import { toStandardSchema } from '../../../schema';
import { ChunkFrom } from '../../../stream/types';
import { createTool } from '../../../tools';
import * as toolPayloadTransform from '../../../tools/payload-transform';
import { ToolStream } from '../../../tools/stream';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
import { wrapToolsWithHooks } from '../../../tools/tool-hooks';
import type { MastraToolInvocationOptions } from '../../../tools/types';
import type { OuterLLMRun } from '../../types';
import { createToolCallStep } from './tool-call-step';

vi.mock('../../../workflows/workflow', () => ({
  createStep: (config: unknown) => config,
  Workflow: class {},
  Run: class {},
}));

// Shared helpers used by multiple describe blocks
const createMessageList = () =>
  ({
    get: {
      input: { aiV5: { model: () => [] } },
      response: { db: () => [] },
      all: { db: () => [], aiV5: { model: () => [] } },
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

  const makeBackgroundSuspendData = () => ({
    toolCallResume: {
      version: 1,
      originRunId: 'current-run',
      stepId: 'toolCallStep',
      type: 'suspension',
      toolCallId: 'call-1',
      toolName: 'background-tool',
      identityDigest: createToolCallIdentityDigest({
        toolCallId: 'call-1',
        toolName: 'background-tool',
        args: { query: 'customers' },
      }),
    },
  });

  const runBackgroundResume = async (resumeData: unknown) => {
    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const messageList = createMessageList();
    const backgroundTaskManager = {
      // A suspended task already exists for this tool call, so the step should
      // resume it rather than dispatch a brand new one.
      listTasks: vi.fn(async () => ({ tasks: [{ id: 'suspended-task-1' }], total: 1 })),
      registerTaskContext: vi.fn(),
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
        suspendData: makeBackgroundSuspendData(),
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
        suspendData: makeBackgroundSuspendData(),
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
        suspendData: makeBackgroundSuspendData(),
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

  it.each([false, 0, '', null])('resumes a suspended background task with falsy payload %#', async resumeData => {
    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const resume = vi.fn().mockResolvedValue({ id: 'task-1' });
    const enqueue = vi.fn();
    const backgroundTaskManager = {
      enqueue,
      resume,
      registerTaskContext: vi.fn(),
      deregisterTaskContext: vi.fn(),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
      listTasks: vi.fn().mockResolvedValue({ tasks: [{ id: 'task-1' }], total: 1 }),
    };
    const args = { query: 'customers' };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': {
          backgroundConfig: { enabled: true },
          execute: vi.fn(),
        },
      } as any,
      messageList: createMessageList(),
      controller,
      runId: 'current-run',
      agentId: 'agent-1',
      streamState,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    const result = await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: { toolCallId: 'call-1', toolName: 'background-tool', args },
        resumeData,
        suspendData: {
          toolCallResume: {
            version: 1,
            originRunId: 'current-run',
            stepId: 'toolCallStep',
            type: 'suspension',
            toolCallId: 'call-1',
            toolName: 'background-tool',
            identityDigest: createToolCallIdentityDigest({
              toolCallId: 'call-1',
              toolName: 'background-tool',
              args,
            }),
          },
        },
      }),
    );

    expect(resume).toHaveBeenCalledWith('task-1', resumeData);
    expect(enqueue).not.toHaveBeenCalled();
    expect(result.result).toContain('Background task resumed');
  });

  it('preserves an approved in-tool grant when resuming a suspended background task', async () => {
    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };
    const resume = vi.fn().mockResolvedValue({ id: 'task-1' });
    const dispatch = vi.fn();
    const backgroundTaskManager = {
      enqueue: dispatch,
      resume,
      registerTaskContext: vi.fn(),
      deregisterTaskContext: vi.fn(),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
      listTasks: vi.fn().mockResolvedValue({ tasks: [{ id: 'task-1' }], total: 1 }),
    };
    const args = { query: 'customers' };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': {
          backgroundConfig: { enabled: true },
          execute: vi.fn(),
        },
      } as any,
      messageList: createMessageList(),
      controller,
      runId: 'current-run',
      agentId: 'agent-1',
      streamState,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);
    const resumeData = { approved: true, reason: 'Reviewed by admin' };

    const result = await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: { toolCallId: 'call-1', toolName: 'background-tool', args },
        resumeData,
        suspendData: {
          toolCallResume: {
            version: 1,
            originRunId: 'current-run',
            stepId: 'toolCallStep',
            type: 'approval',
            approvalSource: 'tool-execution',
            toolCallId: 'call-1',
            toolName: 'background-tool',
            identityDigest: createToolCallIdentityDigest({
              toolCallId: 'call-1',
              toolName: 'background-tool',
              args,
            }),
          },
        },
      }),
    );

    expect(resume).toHaveBeenCalledWith('task-1', resumeData);
    expect(dispatch).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      approval: { id: 'call-1', approved: true, reason: 'Reviewed by admin' },
    });
  });

  const runResumedAwaitedTask = async (
    terminalTask:
      | { id: string; status: 'completed'; result: unknown }
      | { id: string; status: 'failed'; error: { message: string } }
      | { id: string; status: 'cancelled' },
  ) => {
    let registeredContext: any;
    const backgroundTaskManager = {
      listTasks: vi.fn(async () => ({ tasks: [{ id: terminalTask.id }], total: 1 })),
      registerTaskContext: vi.fn((_taskId: string, context: any) => {
        registeredContext = context;
      }),
      resume: vi.fn(async () => {
        if (terminalTask.status !== 'cancelled') {
          setTimeout(async () => {
            await registeredContext.onResult({
              taskId: terminalTask.id,
              toolCallId: 'call-resumed-awaited',
              toolName: 'background-tool',
              agentId: 'agent-1',
              runId: 'current-run',
              status: terminalTask.status,
              ...(terminalTask.status === 'completed' ? { result: { executor: true } } : { error: terminalTask.error }),
              startedAt: new Date(),
              completedAt: new Date(),
            });
          }, 0);
        }
        return { id: terminalTask.id };
      }),
      waitForNextTask: vi.fn(async () => terminalTask),
      enqueue: vi.fn(),
      cancel: vi.fn(),
    };
    const messageList = {
      ...createMessageList(),
      updateToolInvocation: vi.fn(() => true),
      updateMessageMetadataByToolCallId: vi.fn(),
    } as unknown as MessageList;
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
        resumeData: { approved: true },
        suspendData: {
          toolCallResume: {
            version: 1,
            originRunId: 'current-run',
            stepId: 'toolCallStep',
            type: 'approval',
            approvalSource: 'tool-execution',
            toolCallId: 'call-resumed-awaited',
            toolName: 'background-tool',
            identityDigest: createToolCallIdentityDigest({
              toolCallId: 'call-resumed-awaited',
              toolName: 'background-tool',
              args: { query: 'meaning', _background: { disposition: 'awaited' } },
            }),
          },
        },
        inputData: {
          toolCallId: 'call-resumed-awaited',
          toolName: 'background-tool',
          args: { query: 'meaning', _background: { disposition: 'awaited' } },
        },
      }),
    );

    return { result, backgroundTaskManager };
  };

  const runAwaitedMetadataCase = async (resumeExistingTask: boolean) => {
    const toolName = 'background-tool';
    const providerToolCallId = 'provider-resume-call-id';
    const suspendedToolCallId = 'original-resume-call-id';
    const inputArgs = { query: 'meaning', _background: { disposition: 'awaited' } };
    const approvedArgs = { query: 'approved', _background: { disposition: 'awaited' } };
    const inputIdentityDigest = createToolCallIdentityDigest({
      toolCallId: suspendedToolCallId,
      toolName,
      args: inputArgs,
    });
    const approvedIdentityDigest = createToolCallIdentityDigest({
      toolCallId: suspendedToolCallId,
      toolName,
      args: approvedArgs,
    });
    const inputData = {
      toolCallId: providerToolCallId,
      toolName,
      args: {
        ...inputArgs,
        resumeData: { answer: 'continue' },
        suspendedToolCallId,
      },
    };
    const suspendData = {
      toolCallResume: {
        version: 1,
        originRunId: 'current-run',
        stepId: 'toolCallStep',
        type: 'suspension',
        toolCallId: suspendedToolCallId,
        toolName,
        identityDigest: approvedIdentityDigest,
        approvalInputIdentityDigest: inputIdentityDigest,
        approvedArgs,
      },
    };
    let registeredContext: any;
    const onResult = async (context: any) => {
      await context.onResult({
        status: 'completed',
        taskId: 'task-awaited-metadata',
        toolCallId: providerToolCallId,
        toolName,
        agentId: 'agent-1',
        runId: 'current-run',
        result: { authoritative: true },
        startedAt: new Date(),
        completedAt: new Date(),
      });
    };
    const backgroundTaskManager = {
      listTasks: vi.fn(async () =>
        resumeExistingTask ? { tasks: [{ id: 'task-awaited-metadata' }], total: 1 } : { tasks: [], total: 0 },
      ),
      registerTaskContext: vi.fn((_taskId: string, context: any) => {
        registeredContext = context;
      }),
      resume: vi.fn(async () => {
        queueMicrotask(() => void onResult(registeredContext));
        return { id: 'task-awaited-metadata' };
      }),
      enqueue: vi.fn(async (_payload: any, context: any) => {
        queueMicrotask(() => void onResult(context));
        return { task: { id: 'task-awaited-metadata' }, fallbackToSync: false };
      }),
      waitForNextTask: vi.fn(async () => ({
        id: 'task-awaited-metadata',
        status: 'completed',
        result: { authoritative: true },
        timeoutMs: 100,
      })),
      cancel: vi.fn(),
    };
    const messageList = {
      ...createMessageList(),
      updateToolInvocation: vi.fn(() => true),
      updateMessageMetadataByToolCallId: vi.fn(),
    } as unknown as MessageList;
    const toolCallStep = createToolCallStep({
      tools: { [toolName]: { backgroundConfig: { enabled: true }, execute: vi.fn() } } as any,
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
        inputData,
        suspendData,
      }),
    );

    return { result, backgroundTaskManager };
  };

  it.each([
    ['a suspended resume', true],
    ['a fresh dispatch', false],
  ])('preserves awaited resume metadata through %s', async (_label, resumeExistingTask) => {
    const { result } = await runAwaitedMetadataCase(resumeExistingTask);

    expect(result).toMatchObject({
      result: { authoritative: true },
      resumeTargetToolCallId: 'original-resume-call-id',
      approvedArgs: { query: 'approved' },
    });
  });

  it('awaits a resumed awaited task until its authoritative result is reconciled', async () => {
    const { result, backgroundTaskManager } = await runResumedAwaitedTask({
      id: 'task-resumed-awaited',
      status: 'completed',
      result: { authoritative: true },
    });

    expect(result).toMatchObject({ result: { authoritative: true } });
    expect(backgroundTaskManager.registerTaskContext).toHaveBeenCalledWith('task-resumed-awaited', expect.any(Object));
    expect(backgroundTaskManager.resume).toHaveBeenCalledWith(
      'task-resumed-awaited',
      { approved: true },
      {
        waitForAdmission: true,
        abortSignal: undefined,
      },
    );
    expect(backgroundTaskManager.waitForNextTask).toHaveBeenCalledWith(['task-resumed-awaited'], {
      abortSignal: undefined,
      includeSuspended: true,
    });
  });

  it.each([
    {
      status: 'failed' as const,
      task: { id: 'task-resumed-failed', status: 'failed' as const, error: { message: 'resume failed' } },
      message: 'resume failed',
    },
    {
      status: 'cancelled' as const,
      task: { id: 'task-resumed-cancelled', status: 'cancelled' as const },
      message: 'Background task cancelled: task-resumed-cancelled',
    },
  ])('returns a resumed awaited $status task without hanging', async ({ task, message }) => {
    const { result } = await runResumedAwaitedTask(task);

    expect(result as any).toMatchObject({ error: expect.objectContaining({ message }) });
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
    let signalTaskStarted!: () => void;
    const taskStarted = new Promise<void>(resolve => {
      signalTaskStarted = resolve;
    });
    const backgroundTaskManager = {
      enqueue: vi.fn(async (payload: any, context: any) => {
        setTimeout(async () => {
          const result = await context.executor.execute(payload.args);
          signalTaskStarted();
          await context.onResult({
            status: 'completed',
            taskId: 'task-awaited',
            toolCallId: 'call-awaited',
            toolName: 'background-tool',
            agentId: 'agent-1',
            runId: 'current-run',
            result,
            startedAt: new Date(),
            completedAt: new Date(),
          });
          order.push('terminal');
        }, 0);
        return { task: { id: 'task-awaited' }, fallbackToSync: false };
      }),
      waitForNextTask: vi.fn(async () => {
        await taskStarted;
        return { id: 'task-awaited', status: 'completed', result: { answer: 42, authoritative: true } };
      }),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const tools = {
      'background-tool': {
        backgroundConfig: { enabled: true },
        execute: vi.fn(async () => ({ answer: 42 })),
        onOutput: vi.fn(async () => {
          order.push('onOutput');
        }),
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

    expect(result).toMatchObject({ result: { answer: 42, authoritative: true } });
    expect(backgroundTaskManager.waitForNextTask).toHaveBeenCalledWith(['task-awaited'], {
      abortSignal: undefined,
      includeSuspended: true,
    });
    expect(tools['background-tool'].execute).toHaveBeenCalledOnce();
    expect(tools['background-tool'].onOutput).toHaveBeenCalledWith({
      toolCallId: 'call-awaited',
      toolName: 'background-tool',
      output: { answer: 42 },
      abortSignal: undefined,
    });
    expect(order).toEqual(['onOutput', 'reconciled', 'flushed', 'terminal']);
  });

  it('stops awaiting background work when the request is aborted', async () => {
    const abortController = new AbortController();
    const backgroundTaskManager = {
      enqueue: vi.fn(async () => ({ task: { id: 'task-aborted' }, fallbackToSync: false })),
      waitForNextTask: vi.fn(
        async (_taskIds: string[], waitOptions?: { abortSignal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            waitOptions?.abortSignal?.addEventListener('abort', () => reject(waitOptions.abortSignal?.reason), {
              once: true,
            });
          }),
      ),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': {
          backgroundConfig: { enabled: true },
          execute: vi.fn(),
        },
      },
      messageList: createMessageList(),
      controller: { enqueue: vi.fn() },
      options: { abortSignal: abortController.signal },
      runId: 'current-run',
      streamState: { serialize: vi.fn() },
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    const execution = toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: {
          toolCallId: 'call-aborted',
          toolName: 'background-tool',
          args: { _background: { disposition: 'awaited' } },
        },
      }),
    );
    await vi.waitFor(() => expect(backgroundTaskManager.waitForNextTask).toHaveBeenCalledOnce());

    abortController.abort(new Error('request aborted'));

    await expect(execution).resolves.toMatchObject({ aborted: true });
    expect(backgroundTaskManager.waitForNextTask).toHaveBeenCalledWith(['task-aborted'], {
      abortSignal: abortController.signal,
      includeSuspended: true,
    });
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

  it('bounds a hung background result reconciliation by the task timeout', async () => {
    const backgroundTaskManager = {
      enqueue: vi.fn(async () => ({
        task: { id: 'task-reconciliation-timeout', timeoutMs: 20 },
        fallbackToSync: false,
      })),
      waitForNextTask: vi.fn(async () => ({
        id: 'task-reconciliation-timeout',
        status: 'completed',
        result: { answer: 42 },
        timeoutMs: 20,
      })),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': { backgroundConfig: { enabled: true }, execute: vi.fn() },
      } as any,
      messageList: createMessageList(),
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
          toolCallId: 'call-reconciliation-timeout',
          toolName: 'background-tool',
          args: { _background: { disposition: 'awaited' } },
        },
      }),
    );

    expect(result as any).toMatchObject({
      error: expect.objectContaining({
        message: 'Background task "task-reconciliation-timeout" result reconciliation timed out after 20ms',
      }),
    });
  });

  it('returns an awaited cancellation without waiting for result reconciliation', async () => {
    const backgroundTaskManager = {
      enqueue: vi.fn(async () => ({ task: { id: 'task-cancelled' }, fallbackToSync: false })),
      waitForNextTask: vi.fn(async () => ({ id: 'task-cancelled', status: 'cancelled' })),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': { backgroundConfig: { enabled: true }, execute: vi.fn() },
      } as any,
      messageList: createMessageList(),
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
          toolCallId: 'call-cancelled',
          toolName: 'background-tool',
          args: { query: 'cancelled', _background: { disposition: 'awaited' } },
        },
      }),
    );

    expect(result as any).toMatchObject({
      error: expect.objectContaining({ message: 'Background task cancelled: task-cancelled' }),
    });
  });

  it('runs onOutput for deferred background execution', async () => {
    const onOutput = vi.fn();
    let resolveExecution!: () => void;
    const executionComplete = new Promise<void>(resolve => {
      resolveExecution = resolve;
    });
    const backgroundTaskManager = {
      enqueue: vi.fn(async (payload: any, context: any) => {
        setTimeout(async () => {
          await context.executor.execute(payload.args);
          resolveExecution();
        }, 0);
        return { task: { id: 'task-deferred' }, fallbackToSync: false };
      }),
      waitForNextTask: vi.fn(),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': {
          backgroundConfig: { enabled: true },
          execute: vi.fn(async () => ({ answer: 42 })),
          onOutput,
        },
      } as any,
      messageList: createMessageList(),
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
          toolCallId: 'call-deferred',
          toolName: 'background-tool',
          args: { query: 'meaning', _background: { disposition: 'deferred' } },
        },
      }),
    );

    expect(result).toMatchObject({ result: expect.stringContaining('Background task started') });
    await executionComplete;
    expect(onOutput).toHaveBeenCalledOnce();
    expect(onOutput).toHaveBeenCalledWith({
      toolCallId: 'call-deferred',
      toolName: 'background-tool',
      output: { answer: 42 },
      abortSignal: undefined,
    });
  });

  it('returns a serializable result from the background executor', async () => {
    const circular: Record<string, unknown> = { answer: 42 };
    circular.self = circular;
    let executorResult: unknown;
    let resolveExecution!: () => void;
    const executionComplete = new Promise<void>(resolve => {
      resolveExecution = resolve;
    });
    const backgroundTaskManager = {
      enqueue: vi.fn(async (payload: any, context: any) => {
        setTimeout(async () => {
          executorResult = await context.executor.execute(payload.args);
          resolveExecution();
        }, 0);
        return { task: { id: 'task-serialized' }, fallbackToSync: false };
      }),
      waitForNextTask: vi.fn(),
      cancel: vi.fn(),
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
    };
    const toolCallStep = createToolCallStep({
      tools: {
        'background-tool': { backgroundConfig: { enabled: true }, execute: vi.fn(async () => circular) },
      } as any,
      messageList: createMessageList(),
      controller: { enqueue: vi.fn() },
      runId: 'current-run',
      streamState: { serialize: vi.fn() },
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await toolCallStep.execute(
      makeBaseExecuteParams(vi.fn(), {
        inputData: {
          toolCallId: 'call-serialized',
          toolName: 'background-tool',
          args: { query: 'meaning', _background: { disposition: 'deferred' } },
        },
      }),
    );
    await executionComplete;

    expect(executorResult).toEqual({ answer: 42, self: '[Circular]' });
    expect(() => JSON.stringify(executorResult)).not.toThrow();
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
    expect(result).toHaveProperty(
      'abortError',
      expect.objectContaining({ name: 'Error', message: 'The operation was aborted.' }),
    );
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
  let tools: Record<string, { execute: Mock; requireApproval: boolean; validateInput?: Mock }>;
  let messageList: MessageList;
  let toolCallStep: ReturnType<typeof createToolCallStep>;
  let neverResolve: Promise<never>;

  const makeInputData = () => ({
    toolCallId: 'test-call-id',
    toolName: 'test-tool',
    args: { param: 'test' },
  });

  const makeSuspendData = (
    type: 'approval' | 'suspension' = 'approval',
    approvalSource: 'tool-gate' | 'tool-execution' = 'tool-gate',
  ) => ({
    toolCallResume: {
      version: 1,
      originRunId: 'test-run',
      stepId: 'toolCallStep',
      type,
      ...(type === 'approval' ? { approvalSource } : {}),
      toolCallId: 'test-call-id',
      toolName: 'test-tool',
      identityDigest: createToolCallIdentityDigest({
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'test' },
      }),
    },
  });

  const makeExecuteParams = (overrides: any = {}) => {
    const suspendData = overrides.suspendData
      ? { ...makeSuspendData(), ...overrides.suspendData }
      : overrides.suspendData;
    return {
      ...makeBaseExecuteParams(suspend),
      writer: new ToolStream({
        prefix: 'tool',
        callId: 'test-call-id',
        name: 'test-tool',
        runId: 'test-run-id',
      }),
      inputData: makeInputData(),
      ...overrides,
      ...(suspendData ? { suspendData } : {}),
    };
  };

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

  const runEditedApprovalResumeCase = async (transform: 'redacted' | 'safe') => {
    const originalArgs = { param: 'test', limit: 3, nested: { left: 1, right: 2 }, suspendData: 'business input' };
    const editedArgs =
      transform === 'redacted'
        ? { param: 'edited value', nested: { left: 9 }, _background: { enabled: false } }
        : { param: 'edited value', nested: { left: 9 } };
    const approvedArgs = { ...originalArgs, ...editedArgs };
    const executionArgs = { ...originalArgs, param: 'edited value!', nested: { left: 9 } };
    const transcriptArgs = transform === 'redacted' ? { param: '[redacted]' } : approvedArgs;
    const transcriptIsRedacted = transform === 'redacted';
    const originalIdentityDigest = createToolCallIdentityDigest({
      toolCallId: 'test-call-id',
      toolName: 'test-tool',
      args: originalArgs,
    });
    const approvedIdentityDigest = createToolCallIdentityDigest({
      toolCallId: 'test-call-id',
      toolName: 'test-tool',
      args: approvedArgs,
    });
    const transcriptIdentityDigest = createToolCallIdentityDigest({
      toolCallId: 'test-call-id',
      toolName: 'test-tool',
      args: transcriptArgs,
    });
    let resuspendColdResume = false;
    vi.spyOn(toolPayloadTransform, 'transformToolPayloadForTargets').mockImplementation(async context =>
      context.phase === 'input-available'
        ? ({ transcript: { 'input-available': { transformed: transcriptArgs } } } as any)
        : undefined,
    );
    const execute = vi.fn(async (args, context) => {
      if (!context.resumeData || resuspendColdResume) {
        resuspendColdResume = false;
        await context.suspend({ reason: 'more input' });
      }
      return args;
    });
    const builtTool = new CoreToolBuilder({
      originalTool: {
        id: 'test-tool',
        description: 'Test edited approval',
        requireApproval: true,
        inputSchema: z
          .object({
            param: z
              .string()
              .min(1)
              .transform(value => `${value}!`),
            limit: z.number(),
            nested: z.object({ left: z.number(), right: z.number().optional() }),
            suspendData: z.string(),
            _background: z.object({ enabled: z.boolean() }).optional(),
          })
          .strict(),
        execute,
      } as any,
      options: {
        name: 'test-tool',
        description: 'Test edited approval',
        requestContext: new RequestContext(),
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
      },
    }).build();
    const persistedMessageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
    const step = createToolCallStep({
      tools: { 'test-tool': builtTool },
      messageList: persistedMessageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);
    const inputData = { ...makeInputData(), args: originalArgs };
    const persistedSuspensionMessage = {
      id: 'response-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        metadata: {} as Record<string, any>,
        parts: [{ type: 'tool-invocation', toolInvocation: inputData }],
      },
    };
    persistedMessageList.add(persistedSuspensionMessage as any, 'response');
    const suspendData = makeSuspendData();
    suspendData.toolCallResume.identityDigest = originalIdentityDigest;
    const persistSnapshot = vi.fn().mockResolvedValue(undefined);
    const firstResult = await step.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true, editedArgs },
        suspendData,
        suspend: persistSnapshot,
      }),
    );
    expect(firstResult).toBeDefined();

    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]![0]).toEqual(executionArgs);
    const snapshot = JSON.parse(JSON.stringify(persistSnapshot.mock.calls[0]![0]));
    expect(snapshot.toolCallResume).toMatchObject({
      identityDigest: approvedIdentityDigest,
      approval: { id: 'test-call-id', approved: true },
    });
    expect(
      controller.enqueue.mock.calls.find(([chunk]) => chunk.type === 'tool-call-suspended')![0].payload,
    ).not.toHaveProperty('approvedArgs');
    // Auto-resume reconstructs the next call from persisted message metadata,
    // so that path must restore the same approved arguments and provenance.
    const persistedMetadata = persistedMessageList.get.all.db()[0]!.content.metadata as Record<string, any>;
    expect(persistedMetadata.suspendedTools[inputData.toolCallId]).toMatchObject({
      identityDigest: approvedIdentityDigest,
      approvalInputIdentityDigest: originalIdentityDigest,
      approvedArgs,
      args: transcriptArgs,
    });
    const snapshotResult = await step.execute(
      makeExecuteParams({
        inputData,
        resumeData: { answer: 'continue from snapshot' },
        suspendData: snapshot,
      }),
    );
    expect(execute).toHaveBeenCalledTimes(2);
    expect(snapshotResult).toMatchObject({
      args: approvedArgs,
      result: executionArgs,
      approval: { approved: true },
    });
    const result = await step.execute(
      makeExecuteParams({
        inputData: {
          ...inputData,
          args: {
            ...transcriptArgs,
            resumeData: { answer: 'continue' },
            suspendedToolCallId: inputData.toolCallId,
          },
        },
      }),
    );
    expect(execute).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      args: approvedArgs,
      result: executionArgs,
      approval: { approved: true },
    });
    const recalledMessageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' }).deserialize(
      persistedMessageList.serialize(),
    );
    const recalledMessage = recalledMessageList.get.all.db()[0]!;
    const recalledMetadata = recalledMessage.content.metadata as Record<string, any>;
    delete recalledMetadata.suspendedTools[inputData.toolCallId].approvedArgs;
    delete recalledMetadata.suspendedTools[inputData.toolCallId].approvalInputIdentityDigest;
    const recalledInvocation = recalledMessage.content.parts?.find(
      part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === inputData.toolCallId,
    );
    if (recalledInvocation?.type === 'tool-invocation') {
      recalledInvocation.toolInvocation.args = transcriptArgs;
    }
    const editedApprovalResumeLoader = vi.fn().mockResolvedValue({
      approvedArgs,
      approvalInputIdentityDigest: originalIdentityDigest,
    });
    const recalledStep = createToolCallStep({
      tools: { 'test-tool': builtTool },
      messageList: recalledMessageList,
      controller,
      runId: 'cold-resume-run',
      streamState,
      _internal: { editedApprovalResumeLoader },
    } as any);
    expect(recalledMetadata.suspendedTools[inputData.toolCallId]).not.toHaveProperty('approvedArgs');
    expect(recalledMetadata.suspendedTools[inputData.toolCallId]).not.toHaveProperty('approvalInputIdentityDigest');
    resuspendColdResume = true;
    const recalledResult = await recalledStep.execute(
      makeExecuteParams({
        inputData: {
          ...inputData,
          args: {
            ...transcriptArgs,
            resumeData: { answer: 'continue after cold recall' },
            suspendedToolCallId: inputData.toolCallId,
          },
        },
        suspend: persistSnapshot,
      }),
    );
    if (transcriptIsRedacted) {
      expect(editedApprovalResumeLoader).toHaveBeenCalledOnce();
      expect(editedApprovalResumeLoader).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: 'test-run',
          originRunId: 'test-run',
          toolCallId: inputData.toolCallId,
          toolName: inputData.toolName,
          identityDigest: approvedIdentityDigest,
        }),
      );
    } else {
      expect(editedApprovalResumeLoader).not.toHaveBeenCalled();
    }
    expect(recalledResult).toMatchObject({
      args: approvedArgs,
      result: executionArgs,
      approval: { approved: true },
      approvedArgs,
    });
    const secondSnapshot = JSON.parse(JSON.stringify(persistSnapshot.mock.calls.at(-1)![0]));
    expect(secondSnapshot.toolCallResume).toMatchObject({
      originRunId: 'cold-resume-run',
      identityDigest: approvedIdentityDigest,
      ...(transcriptIsRedacted
        ? {
            approvalInputIdentityDigest: transcriptIdentityDigest,
            approvedArgs,
          }
        : {}),
    });
    expect(recalledMetadata.suspendedTools[inputData.toolCallId]).toMatchObject({
      originRunId: 'cold-resume-run',
      runId: 'cold-resume-run',
      identityDigest: approvedIdentityDigest,
      resumeIdentityDigest: transcriptIdentityDigest,
      ...(transcriptIsRedacted
        ? {
            approvalInputIdentityDigest: transcriptIdentityDigest,
            approvedArgs,
          }
        : {}),
    });
    // Persisted transcript metadata retains the new suspension identity and ownership
    // coordinates while filtering the canonical approval fields.
    delete recalledMetadata.suspendedTools[inputData.toolCallId].approvedArgs;
    delete recalledMetadata.suspendedTools[inputData.toolCallId].approvalInputIdentityDigest;
    const recalledResumeResult = await recalledStep.execute(
      makeExecuteParams({
        inputData: {
          ...inputData,
          toolCallId: 'provider-repeat-call',
          args: {
            ...transcriptArgs,
            resumeData: { answer: 'stale provider answer' },
            suspendedToolCallId: inputData.toolCallId,
            suspendedToolRunId: 'test-run',
          },
        },
        resumeData: { answer: 'authoritative workflow answer' },
        suspendData: secondSnapshot,
      }),
    );
    expect(editedApprovalResumeLoader).toHaveBeenCalledTimes(transcriptIsRedacted ? 1 : 0);
    expect(recalledResumeResult).toMatchObject({
      args: approvedArgs,
      result: executionArgs,
      approval: { approved: true },
    });
    expect(execute.mock.calls.at(-1)?.[1].resumeData).toEqual({ answer: 'authoritative workflow answer' });
    expect(execute).toHaveBeenCalledTimes(5);
    expect(originalArgs).toEqual({
      param: 'test',
      limit: 3,
      nested: { left: 1, right: 2 },
      suspendData: 'business input',
    });
  };

  it.each([
    { label: 'redacted transcript', transform: 'redacted' as const },
    { label: 'safe unchanged transcript', transform: 'safe' as const },
  ])(
    'executes validated edited approval arguments and preserves them through re-suspension ($label)',
    async ({ transform }) => {
      await runEditedApprovalResumeCase(transform);
    },
  );

  it('rejects invalid or unsupported edited approvals before tool side effects', async () => {
    const execute = vi.fn(async args => args);
    const builtTool = new CoreToolBuilder({
      originalTool: createTool({
        id: 'test-tool',
        description: 'Strict tool',
        requireApproval: true,
        inputSchema: z.object({ param: z.string().min(1) }).strict(),
        execute,
      }),
      options: {
        name: 'test-tool',
        description: 'Strict tool',
        requestContext: new RequestContext(),
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
      },
    }).build();
    const pendingApprovalMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              ...makeSuspendData().toolCallResume,
              args: makeInputData().args,
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([pendingApprovalMessage]);
    const initialPendingApprovals = structuredClone(pendingApprovalMessage.content.metadata.pendingToolApprovals);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [pendingApprovalMessage] as any;
    }
    const flushMessages = vi.fn().mockResolvedValue(undefined);
    const step = createToolCallStep({
      tools: { 'test-tool': builtTool },
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        threadId: 'thread-id',
      },
    } as any);
    const invalidCases = [
      [
        { approved: true, editedArgs: { unexpected: 'no' } },
        makeSuspendData(),
        'Tool input validation failed for test-tool.',
      ],
      [
        { approved: false, editedArgs: { param: 'changed' } },
        makeSuspendData(),
        'Tool resume evidence did not match the suspended tool call',
      ],
      [
        { approved: true, editedArgs: { resumeData: { approved: true } } },
        makeSuspendData(),
        'Tool resume evidence did not match the suspended tool call',
      ],
      [
        { approved: true, editedArgs: { param: 'changed' } },
        makeSuspendData('approval', 'tool-execution'),
        'Edited approval arguments require a regular tool-gate approval',
      ],
      [
        { approved: true, editedArgs: { param: 'changed' } },
        { ...makeSuspendData(), suspendedToolRunId: 'delegate-run' },
        'Edited approval arguments require a regular tool-gate approval',
      ],
      [
        { approved: true, editedArgs: { param: 'changed' } },
        { toolCallResume: { ...makeSuspendData().toolCallResume, identityDigest: 'tampered' } },
        'Tool resume evidence did not match the suspended tool call',
      ],
    ] as const;
    for (const [index, [resumeData, suspendData, expectedMessage]] of invalidCases.entries()) {
      const result = await step.execute(makeExecuteParams({ resumeData, suspendData }));
      expect(result.error ?? result.result).toMatchObject({ message: expect.stringContaining(expectedMessage) });
      expect(execute).not.toHaveBeenCalled();
      if (index === 0) {
        expect(pendingApprovalMessage.content.metadata.pendingToolApprovals).toBeUndefined();
        expect(flushMessages).toHaveBeenCalledOnce();
      }
    }
    const unvalidated = await toolCallStep.execute(
      makeExecuteParams({
        resumeData: { approved: true, editedArgs: { param: 'changed' } },
        suspendData: makeSuspendData(),
      }),
    );
    expect(unvalidated.error.message).toBe('Edited approval arguments require a tool input validator');
    pendingApprovalMessage.content.metadata.pendingToolApprovals = initialPendingApprovals;
    builtTool.validateInput = vi.fn().mockRejectedValue(new Error('native validation rejected'));
    const rejected = await step.execute(
      makeExecuteParams({
        resumeData: { approved: true, editedArgs: { param: 'changed' } },
        suspendData: makeSuspendData(),
      }),
    );
    expect(rejected.error).toMatchObject({ message: 'native validation rejected' });
    expect(pendingApprovalMessage.content.metadata.pendingToolApprovals).toBeUndefined();
    expectNoToolExecution();
    expect(execute).not.toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
  });

  it('returns invalid input to the model before asking for approval', async () => {
    const validationError = {
      error: true,
      message: 'Tool input validation failed for test-tool.',
      validationErrors: {
        errors: [],
        fields: { param: { errors: ['Invalid input'], fields: {} } },
      },
    };
    tools['test-tool'].validateInput = vi.fn().mockReturnValue({ error: validationError });

    const result = await toolCallStep.execute(makeExecuteParams());

    expect(tools['test-tool'].validateInput).toHaveBeenCalledWith({ param: 'test' });
    expect(suspend).not.toHaveBeenCalled();
    expectNoToolExecution();
    expect(result).toEqual({
      result: validationError,
      ...makeInputData(),
    });
  });

  it('preserves Error details from approval preflight validation across serialization', async () => {
    tools['test-tool'].validateInput = vi.fn().mockReturnValue({
      error: new TypeError('Tool input must include a valid param.'),
    });

    const result = await toolCallStep.execute(makeExecuteParams());
    const serializedResult = JSON.parse(JSON.stringify(result));

    expect(suspend).not.toHaveBeenCalled();
    expectNoToolExecution();
    expect(serializedResult).toMatchObject({
      result: {
        name: 'TypeError',
        message: 'Tool input must include a valid param.',
      },
      ...makeInputData(),
    });
  });

  it('normalizes evidence-free null resume placeholders on a fresh tool call', async () => {
    const resultValue = { success: true };
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockResolvedValue(resultValue);
    const freshCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    });
    const inputData = {
      ...makeInputData(),
      args: {
        param: 'test',
        resumeData: null,
        suspendedToolCallId: null,
        suspendedToolRunId: null,
      },
    };

    const result = await freshCallStep.execute(makeExecuteParams({ inputData }));

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      { param: 'test' },
      expect.objectContaining({ resumeData: undefined }),
    );
    expect(result).toEqual({ ...inputData, result: resultValue });
  });

  it('uses explicit workflow approval data when provider resume controls are null placeholders', async () => {
    const resultValue = { success: true };
    tools['test-tool'].execute.mockResolvedValue(resultValue);
    const inputData = {
      ...makeInputData(),
      args: {
        param: 'test',
        resumeData: null,
        suspendedToolCallId: null,
        suspendedToolRunId: null,
      },
    };

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true },
        suspendData: makeSuspendData(),
      }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      { param: 'test' },
      expect.objectContaining({ resumeData: undefined }),
    );
    expect(result).toEqual({
      ...inputData,
      result: resultValue,
      approval: { id: inputData.toolCallId, approved: true },
    });
  });

  it('uses explicit workflow suspension data when provider resume controls are null placeholders', async () => {
    const workflowResumeData = { answer: 'continue' };
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockImplementation(async (_args, context) => ({
      resumeData: context.resumeData,
    }));
    const inputData = {
      ...makeInputData(),
      args: {
        param: 'test',
        resumeData: null,
        suspendedToolCallId: null,
        suspendedToolRunId: null,
      },
    };

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: workflowResumeData,
        suspendData: makeSuspendData('suspension'),
      }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      { param: 'test' },
      expect.objectContaining({ resumeData: workflowResumeData }),
    );
    expect(result).toEqual({
      ...inputData,
      result: { resumeData: workflowResumeData },
      resumedFromSuspension: true,
    });
  });

  it('rejects a null resume payload that names an unverified suspended run', async () => {
    tools['test-tool'].requireApproval = false;
    const inputData = {
      ...makeInputData(),
      args: { param: 'test', resumeData: null, suspendedToolRunId: 'unverified-run' },
    };

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true },
        suspendData: makeSuspendData(),
      }),
    );

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it('does not let workflow resume data bypass model-driven call identity checks', async () => {
    const inputData = {
      ...makeInputData(),
      args: {
        param: 'test',
        resumeData: { approved: true },
        suspendedToolCallId: 'unverified-call',
      },
    };

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true },
        suspendData: makeSuspendData(),
      }),
    );

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it('should enqueue approval message and prevent execution when approval is required', async () => {
    const inputData = makeInputData();

    const executePromise = toolCallStep.execute(makeExecuteParams({ inputData }));
    await new Promise(resolve => setImmediate(resolve));

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
      expect.objectContaining({
        toolCallResume: makeSuspendData().toolCallResume,
        requireToolApproval: {
          toolCallId: 'test-call-id',
          toolName: 'test-tool',
          args: { param: 'test' },
        },
        __streamState: 'serialized-state',
      }),
      {
        resumeLabel: 'test-call-id',
      },
    );

    expectNoToolExecution();

    await expect(Promise.race([executePromise, Promise.resolve('completed')])).resolves.toBe('completed');
  });

  it('binds approval recall identity to display-transformed arguments', async () => {
    const transformedController = { enqueue: vi.fn() };
    const transformedStep = createToolCallStep({
      tools,
      messageList,
      controller: transformedController,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
      _internal: {
        toolPayloadTransform: {
          targets: ['display'],
          transformToolPayload: ({ target, phase }: any) =>
            target === 'display' && phase === 'approval' ? { param: 'redacted' } : undefined,
        },
      },
    } as any);

    void transformedStep.execute(makeExecuteParams());
    await new Promise(resolve => setImmediate(resolve));

    const approvalChunk = transformedController.enqueue.mock.calls
      .map(([chunk]) => chunk)
      .find(chunk => chunk.type === 'tool-call-approval');
    expect(approvalChunk.payload.resumeIdentityDigest).toBe(
      createToolCallIdentityDigest({
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'redacted' },
      }),
    );
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

  it('binds suspension recall identity to the transformed arguments exposed in the data part', async () => {
    const transformedController = { enqueue: vi.fn() };
    const suspensionTools = {
      'test-tool': {
        requireApproval: false,
        execute: vi.fn(async (_args: unknown, context: any) => {
          await context.suspend({ reason: 'wait' });
        }),
      },
    };
    const transformedStep = createToolCallStep({
      tools: suspensionTools,
      messageList,
      controller: transformedController,
      runId: 'test-run',
      streamState,
      _internal: {
        toolPayloadTransform: {
          targets: ['display'],
          transformToolPayload: ({ target, phase }: any) =>
            target === 'display' && (phase === 'input-available' || phase === 'suspend')
              ? { param: 'redacted' }
              : undefined,
        },
      },
    } as any);

    void transformedStep.execute(makeExecuteParams());
    await new Promise(resolve => setImmediate(resolve));

    const suspensionChunk = transformedController.enqueue.mock.calls
      .map(([chunk]) => chunk)
      .find(chunk => chunk.type === 'tool-call-suspended');
    expect(suspensionChunk.payload.resumeIdentityDigest).toBe(
      createToolCallIdentityDigest({
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: { param: 'redacted' },
      }),
    );
  });

  it('keeps a suspension-payload transform separate from resumed tool arguments', async () => {
    vi.spyOn(toolPayloadTransform, 'transformToolPayloadForTargets').mockImplementation(async context =>
      context.phase === 'suspend'
        ? ({
            display: { suspend: { transformed: { reason: 'redacted-display-suspend-payload' } } },
            transcript: { suspend: { transformed: { reason: 'redacted-transcript-suspend-payload' } } },
          } as any)
        : undefined,
    );
    const transformedController = { enqueue: vi.fn() };
    const assistantMessage: any = {
      id: 'assistant-message',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
            },
          },
        ],
      },
      createdAt: new Date(),
    };
    const transformedMessageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [assistantMessage] },
        all: { db: () => [assistantMessage] },
      },
    } as unknown as MessageList;
    const suspensionTools = {
      'test-tool': {
        requireApproval: false,
        execute: vi.fn(async (_args: unknown, context: any) => {
          await context.suspend({ reason: 'wait' });
        }),
      },
    };
    const transformedStep = createToolCallStep({
      tools: suspensionTools,
      messageList: transformedMessageList,
      controller: transformedController,
      runId: 'test-run',
      streamState,
    } as any);

    void transformedStep.execute(makeExecuteParams());
    await new Promise(resolve => setImmediate(resolve));

    const suspensionChunk = transformedController.enqueue.mock.calls
      .map(([chunk]) => chunk)
      .find(chunk => chunk.type === 'tool-call-suspended');
    const expectedResumeIdentityDigest = createToolCallIdentityDigest({
      toolCallId: 'test-call-id',
      toolName: 'test-tool',
      args: { param: 'test' },
    });
    expect(suspensionChunk.payload.resumeIdentityDigest).toBe(expectedResumeIdentityDigest);
    expect(assistantMessage.content.metadata.suspendedTools['test-call-id']).toMatchObject({
      args: { param: 'test' },
      suspendPayload: { reason: 'redacted-transcript-suspend-payload' },
      resumeIdentityDigest: expectedResumeIdentityDigest,
    });
  });

  it('preserves explicit null transcript transforms for suspended tool state', async () => {
    vi.spyOn(toolPayloadTransform, 'transformToolPayloadForTargets').mockImplementation(async context => {
      if (context.phase === 'input-available') {
        return {
          transcript: { 'input-available': { transformed: null } },
        } as any;
      }
      if (context.phase === 'suspend') {
        return {
          transcript: { suspend: { transformed: null } },
        } as any;
      }
      return undefined;
    });
    const transformedController = { enqueue: vi.fn() };
    const assistantMessage: any = {
      id: 'assistant-message',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
            },
          },
        ],
      },
      createdAt: new Date(),
    };
    const transformedMessageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [assistantMessage] },
        all: { db: () => [assistantMessage] },
      },
    } as unknown as MessageList;
    const suspensionTools = {
      'test-tool': {
        requireApproval: false,
        execute: vi.fn(async (_args: unknown, context: any) => {
          await context.suspend({ reason: 'private wait reason' });
        }),
      },
    };
    const transformedStep = createToolCallStep({
      tools: suspensionTools,
      messageList: transformedMessageList,
      controller: transformedController,
      runId: 'test-run',
      streamState,
    } as any);

    void transformedStep.execute(makeExecuteParams());
    await new Promise(resolve => setImmediate(resolve));

    expect(assistantMessage.content.metadata.suspendedTools['test-call-id']).toMatchObject({
      args: null,
      suspendPayload: null,
      resumeIdentityDigest: createToolCallIdentityDigest({
        toolCallId: 'test-call-id',
        toolName: 'test-tool',
        args: null,
      }),
    });
  });

  it('should preserve edited arguments when a later in-tool approval is declined', async () => {
    const inputData = makeInputData();
    const resumeData = { approved: false };
    const approvedArgs = { param: 'edited' };
    const suspendData = makeSuspendData('approval', 'tool-execution');
    suspendData.toolCallResume = {
      ...suspendData.toolCallResume,
      identityDigest: createToolCallIdentityDigest({ ...inputData, args: approvedArgs }),
      approvalInputIdentityDigest: createToolCallIdentityDigest(inputData),
      approvedArgs,
    };
    const beforeToolCall = vi.fn();
    const afterToolCall = vi.fn();
    const hookedTools = wrapToolsWithHooks(
      tools as any,
      { beforeToolCall, afterToolCall },
      { agentId: 'test-agent', agentName: 'Test agent' },
    );
    const hookedToolCallStep = createToolCallStep({
      tools: hookedTools,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
    } as any);

    const result = await hookedToolCallStep.execute(makeExecuteParams({ inputData, resumeData, suspendData }));

    // The verified marker lets persistence replace the original invocation args with the
    // edited args that were approved before the tool requested this later approval.
    expect(result).toEqual({
      ...inputData,
      args: approvedArgs,
      approvedArgs,
      approval: {
        id: inputData.toolCallId,
        approved: false,
        reason: 'Tool call was not approved by the user',
      },
    });
    expectNoToolExecution();
    expect(beforeToolCall).not.toHaveBeenCalled();
    expect(afterToolCall).not.toHaveBeenCalled();
  });

  it('does not run execution hooks when the action-time permission policy denies a tool', async () => {
    tools['test-tool'].requireApproval = false;
    const beforeToolCall = vi.fn();
    const afterToolCall = vi.fn();
    const hookedTools = wrapToolsWithHooks(
      tools as any,
      { beforeToolCall, afterToolCall },
      { agentId: 'test-agent', agentName: 'Test agent' },
    );
    const deniedToolCallStep = createToolCallStep({
      tools: hookedTools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);
    const requestContext = new RequestContext();
    requestContext.set('__mastra_toolPermissionPolicy', () => 'deny');

    const result = await deniedToolCallStep.execute(makeExecuteParams({ inputData: makeInputData(), requestContext }));

    expect(result).toEqual({
      ...makeInputData(),
      disposition: 'denied',
      result: 'Tool "test-tool" was denied by the session permission policy.',
    });
    expectNoToolExecution();
    expect(beforeToolCall).not.toHaveBeenCalled();
    expect(afterToolCall).not.toHaveBeenCalled();
  });

  it('should preserve a user-provided decline reason', async () => {
    const inputData = {
      ...makeInputData(),
      approval: { id: 'stale-approval', approved: true },
    };

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: false, reason: 'Not safe' },
        suspendData: makeSuspendData(),
      }),
    );

    expect(result).toEqual({
      approval: {
        id: inputData.toolCallId,
        approved: false,
        reason: 'Not safe',
      },
      toolCallId: inputData.toolCallId,
      toolName: inputData.toolName,
      args: inputData.args,
    });
    expectNoToolExecution();
  });

  it('should reject a model-driven decline against the original pending tool call', async () => {
    // PF-1703 originally accepted an args-borne approval decision once its identity matched the
    // pending call. Upstream closed that: approval is a consent boundary and is never
    // reconstructed by the model (see `buildAutoResumeSystemMessageSuffix`, which no longer
    // advertises approval suspensions at all). The fork's only consent producer is
    // `agent.resumeStream(resumeData, { runId, toolCallId })`, which arrives as workflow
    // resumeData — see the 'should preserve a user-provided decline reason' case above. A
    // model-authored decision now fails closed and leaves the pending approval intact.
    const inputData = {
      toolCallId: 'provider-resume-call-id',
      toolName: 'test-tool',
      args: {
        param: 'test',
        resumeData: { approved: false, reason: 'Not safe' },
        suspendedToolCallId: 'test-call-id',
      },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, suspendData: makeSuspendData() }));

    expect(result.approval).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it('should use canonical arguments only for execution when a display-transformed model resume is replayed', async () => {
    // PF-1703 display-transform contract: the persisted approval/suspension entry may store
    // redacted args, so the entry carries `resumeIdentityDigest` over the DISPLAY args while
    // `identityDigest` stays over the canonical ones. A matching model replay is authenticated
    // against the display digest and then executed against the canonical args only.
    // Exercised on a SUSPENSION entry: an approval-typed entry can no longer be resumed from
    // model-authored args at all (see the consent-boundary cases below).
    const canonicalArgs = { param: 'private-value' };
    const displayArgs = { param: 'redacted' };
    const assistantMessage: any = {
      role: 'assistant',
      content: {
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: canonicalArgs,
            },
          },
        ],
        metadata: {
          suspendedTools: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: displayArgs,
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: canonicalArgs,
              }),
              resumeIdentityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: displayArgs,
              }),
              type: 'suspension',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
      },
    };
    let receivedArgs: unknown;
    const execute = vi.fn().mockImplementation(async executionArgs => {
      receivedArgs = structuredClone(executionArgs);
      executionArgs.param = 'mutated-by-tool';
      return { success: true };
    });
    const transformedStep = createToolCallStep({
      tools: { 'test-tool': { execute, requireApproval: false } },
      messageList: {
        get: {
          input: { aiV5: { model: () => [] } },
          response: { db: () => [assistantMessage] },
          all: { db: () => [assistantMessage] },
        },
      } as unknown as MessageList,
      controller,
      runId: 'test-run',
      streamState,
    });
    const inputData = {
      toolCallId: 'provider-resume-call-id',
      toolName: 'test-tool',
      args: {
        ...displayArgs,
        resumeData: { answer: 'continue' },
        suspendedToolCallId: 'test-call-id',
      },
    };

    const result = await transformedStep.execute(makeExecuteParams({ inputData }));

    expect(receivedArgs).toEqual(canonicalArgs);
    expect(execute).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ resumeData: { answer: 'continue' } }),
    );
    expect(assistantMessage.content.parts[0].toolInvocation.args).toEqual(canonicalArgs);
    expect(result).toMatchObject({
      result: { success: true },
      toolCallId: 'provider-resume-call-id',
      resumeTargetToolCallId: 'test-call-id',
    });
  });

  it.each([true, false])(
    'should reject a display-transformed model resume of a pending approval: approved=%s',
    async approved => {
      // Same fixture as above but stored as an APPROVAL. Identity matching authenticates that the
      // replay refers to this pending call; it does not establish that a human decided, so the
      // step fails closed for both a grant and a decline and leaves the approval pending.
      const canonicalArgs = { param: 'private-value' };
      const displayArgs = { param: 'redacted' };
      const assistantMessage: any = {
        role: 'assistant',
        content: {
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: canonicalArgs,
              },
            },
          ],
          metadata: {
            pendingToolApprovals: {
              'test-call-id': {
                version: 1,
                originRunId: 'test-run',
                stepId: 'toolCallStep',
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: displayArgs,
                identityDigest: createToolCallIdentityDigest({
                  toolCallId: 'test-call-id',
                  toolName: 'test-tool',
                  args: canonicalArgs,
                }),
                resumeIdentityDigest: createToolCallIdentityDigest({
                  toolCallId: 'test-call-id',
                  toolName: 'test-tool',
                  args: displayArgs,
                }),
                type: 'approval',
                approvalSource: 'tool-gate',
                runId: 'test-run',
              },
            },
          },
        },
      };
      const execute = vi.fn();
      const transformedStep = createToolCallStep({
        tools: { 'test-tool': { execute, requireApproval: true } },
        messageList: {
          get: {
            input: { aiV5: { model: () => [] } },
            response: { db: () => [assistantMessage] },
            all: { db: () => [assistantMessage] },
          },
        } as unknown as MessageList,
        controller,
        runId: 'test-run',
        streamState,
      });
      const inputData = {
        toolCallId: 'provider-resume-call-id',
        toolName: 'test-tool',
        args: {
          ...displayArgs,
          resumeData: { approved },
          suspendedToolCallId: 'test-call-id',
        },
      };

      const result = await transformedStep.execute(makeExecuteParams({ inputData }));

      expect(result.approval).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
      expect(execute).not.toHaveBeenCalled();
      expect(assistantMessage.content.metadata.pendingToolApprovals).toHaveProperty('test-call-id');
    },
  );

  it('should reject a display-transformed model resume when canonical arguments are unavailable', async () => {
    const canonicalArgs = { param: 'private-value' };
    const displayArgs = { param: 'redacted' };
    const assistantMessage: any = {
      role: 'assistant',
      content: {
        parts: [],
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: displayArgs,
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: canonicalArgs,
              }),
              resumeIdentityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: displayArgs,
              }),
              type: 'approval',
              approvalSource: 'tool-gate',
              runId: 'test-run',
            },
          },
        },
      },
    };
    const execute = vi.fn();
    const transformedStep = createToolCallStep({
      tools: { 'test-tool': { execute, requireApproval: true } },
      messageList: {
        get: {
          input: { aiV5: { model: () => [] } },
          response: { db: () => [assistantMessage] },
          all: { db: () => [assistantMessage] },
        },
      } as unknown as MessageList,
      controller,
      runId: 'test-run',
      streamState,
    });
    const inputData = {
      toolCallId: 'provider-resume-call-id',
      toolName: 'test-tool',
      args: {
        ...displayArgs,
        resumeData: { approved: true },
        suspendedToolCallId: 'test-call-id',
      },
    };

    const result = await transformedStep.execute(makeExecuteParams({ inputData }));

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expect(execute).not.toHaveBeenCalled();
  });

  it('should reject malformed approval resumes without executing the tool', async () => {
    const inputData = makeInputData();

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData: {}, suspendData: makeSuspendData() }),
    );

    expect(result).toEqual({ ...inputData, error: expect.any(Error) });
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it.each([
    { field: 'type', value: 'future-approval' },
    { field: 'identityDigest', value: 'tampered' },
    { field: 'originRunId', value: 'other-run' },
  ])('should fail closed for a corrupt authoritative $field', async ({ field, value }) => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    tools['test-tool'].requireApproval = false;
    (tools['test-tool'] as any).needsApprovalFn = needsApprovalFn;
    const suspendData = makeSuspendData();
    (suspendData.toolCallResume as Record<string, unknown>)[field] = value;

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData: makeInputData(), resumeData: { approved: true }, suspendData }),
    );

    expect(result.approval).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(needsApprovalFn).not.toHaveBeenCalled();
    expectNoToolExecution();
  });

  it('should ignore unrelated approval resume context without forwarding it to the tool', async () => {
    const inputData = makeInputData();
    tools['test-tool'].execute.mockResolvedValue({ success: true });
    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true, toolName: 'caller-tool', toolCallId: 'caller-call' },
        suspendData: makeSuspendData(),
      }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({ resumeData: undefined }),
    );
    expect(result.approval).toEqual({ id: inputData.toolCallId, approved: true });
  });

  it('should never forward an approval reason to tool resumeData', async () => {
    const inputData = makeInputData();
    tools['test-tool'].execute.mockResolvedValue({ success: true });

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true, reason: 'reviewed' },
        suspendData: makeSuspendData(),
      }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({ resumeData: undefined }),
    );
    expect(result.approval).toEqual({
      id: inputData.toolCallId,
      approved: true,
      reason: 'reviewed',
    });
  });

  it('should deliver an approved in-tool decision back to the suspended tool', async () => {
    const inputData = makeInputData();
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockImplementation(async (_args, context) => ({
      resumed: context.resumeData?.approved,
    }));

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        resumeData: { approved: true },
        suspendData: makeSuspendData('approval', 'tool-execution'),
      }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({ resumeData: { approved: true } }),
    );
    expect(result).toEqual({
      result: { resumed: true },
      approval: { id: inputData.toolCallId, approved: true },
      ...inputData,
    });
  });

  it('should honor declined approval even if needsApprovalFn later returns false', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    tools['test-tool'].requireApproval = false;
    (tools['test-tool'] as any).needsApprovalFn = needsApprovalFn;
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'approval',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }
    const inputData = makeInputData();
    const resumeData = { approved: false };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

    // A declined approval returns the decision (not a `result` string) so it persists as
    // `output-denied` with the approval object; the reason carries the existing message.
    expect(result).toEqual({
      ...inputData,
      approval: {
        id: inputData.toolCallId,
        approved: false,
        reason: 'Tool call was not approved by the user',
      },
    });
    expect(needsApprovalFn).not.toHaveBeenCalled();
    expectNoToolExecution();
  });

  it('should reject malformed stored approval resumes even if needsApprovalFn later returns false', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    tools['test-tool'].requireApproval = false;
    (tools['test-tool'] as any).needsApprovalFn = needsApprovalFn;
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'approval',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }
    const inputData = makeInputData();

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData: {} }));

    expect(result).toEqual({ ...inputData, error: expect.any(Error) });
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expect(needsApprovalFn).not.toHaveBeenCalled();
    expectNoToolExecution();
  });

  it('should reject a stored approval bound to another origin run', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    tools['test-tool'].requireApproval = false;
    (tools['test-tool'] as any).needsApprovalFn = needsApprovalFn;
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'other-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'approval',
              runId: 'other-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }

    const inputData = makeInputData();
    const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData: { approved: true } }));

    expect(result).toEqual({ ...inputData, error: expect.any(Error) });
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expect(needsApprovalFn).not.toHaveBeenCalled();
    expectNoToolExecution();
  });

  // Upstream consent hardening: an approval decision may only arrive through the workflow
  // resume boundary (`agent.resumeStream` / the durable resume envelope). `resumeData` the
  // model wrote into its own tool arguments is untrusted and can neither grant nor decline
  // consent. Suspension-typed args-borne resume (autoResumeSuspendedTools) is unaffected.
  it('does not accept model-authored approval data against a matching pending approval', async () => {
    // The identity digest is not a secret — it is persisted on the `data-tool-call-approval`
    // part the model can read back. A model that replays the pending call id plus byte-identical
    // args would otherwise satisfy the identity check and self-grant consent.
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'approval',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }
    const inputData = {
      toolCallId: 'llm-replay-call-id',
      toolName: 'test-tool',
      args: { param: 'test', resumeData: { approved: true }, suspendedToolCallId: 'test-call-id' },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.approval).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it('does not accept a model-authored approval decline against a matching pending approval', async () => {
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'approval',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }
    const inputData = {
      toolCallId: 'llm-replay-call-id',
      toolName: 'test-tool',
      args: { param: 'test', resumeData: { approved: false }, suspendedToolCallId: 'test-call-id' },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.approval).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it('does not accept model-authored approval data on a fresh gated call', async () => {
    // Upstream re-suspends here; this fork fails closed with an invalid-resume-evidence error
    // (there is no stored approval entry, so the resume type is unknown). Either way the gated
    // tool must not execute and the model must not be credited with a decision.
    const inputData = {
      ...makeInputData(),
      args: { param: 'test', resumeData: { approved: true } },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(result.approval).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expectNoToolExecution();
  });

  it.each([{}, { approved: 'true' }])(
    'rejects malformed workflow approval data on a fresh gated call: %j',
    async resumeData => {
      const inputData = makeInputData();

      const result = await toolCallStep.execute(makeExecuteParams({ inputData, resumeData }));

      expect(result.approval).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
      expectNoToolExecution();
    },
  );

  it('should accept an exact LLM resume from a later conversation run', async () => {
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockResolvedValue({ resumed: true });
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          suspendedTools: {
            'test-call-id': {
              version: 1,
              originRunId: 'originating-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'suspension',
              runId: 'suspended-tool-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }
    const inputData = {
      toolCallId: 'new-provider-call-id',
      toolName: 'test-tool',
      args: {
        param: 'test',
        resumeData: { answer: 'continue' },
        suspendedToolCallId: 'test-call-id',
        suspendedToolRunId: 'suspended-tool-run',
      },
    };

    const result = await toolCallStep.execute(makeExecuteParams({ inputData }));

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      { param: 'test' },
      expect.objectContaining({ resumeData: { answer: 'continue' } }),
    );
    expect(result).toEqual({
      result: { resumed: true },
      ...inputData,
      resumeTargetToolCallId: 'test-call-id',
      resumedFromSuspension: true,
    });
  });

  it('should consume approved stored approval resumes even if needsApprovalFn later returns false', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    const toolResult = { success: true };
    tools['test-tool'].requireApproval = false;
    (tools['test-tool'] as any).needsApprovalFn = needsApprovalFn;
    tools['test-tool'].execute.mockResolvedValue(toolResult);
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'test-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'test-call-id',
              toolName: 'test-tool',
              args: { param: 'test' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'test-call-id',
                toolName: 'test-tool',
                args: { param: 'test' },
              }),
              type: 'approval',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    (messageList.get.all.db as Mock).mockReturnValue?.([assistantMessage]);
    if (!('mock' in messageList.get.all.db)) {
      messageList.get.all.db = () => [assistantMessage];
    }
    const flushMessages = vi.fn();
    const step = createToolCallStep({
      tools,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        threadId: 'thread-id',
      },
    } as any);
    const inputData = makeInputData();

    const result = await step.execute(makeExecuteParams({ inputData, resumeData: { approved: true } }));

    expect(needsApprovalFn).toHaveBeenCalled();
    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        resumeData: undefined,
      }),
    );
    expect(assistantMessage.content.metadata.pendingToolApprovals).toBeUndefined();
    expect(flushMessages).toHaveBeenCalled();
    expect(result).toEqual({
      result: toolResult,
      approval: {
        id: inputData.toolCallId,
        approved: true,
      },
      ...inputData,
    });
  });

  it('should preserve approval when an approved tool throws', async () => {
    const inputData = makeInputData();
    const error = new Error('Tool failed after approval');
    tools['test-tool'].execute.mockRejectedValue(error);

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData: { approved: true }, suspendData: makeSuspendData() }),
    );

    // Upstream #17836: errors are reified to serialization-safe plain objects
    // before persisting; the approval provenance (fork PF-1703) must survive.
    expect(result).toEqual({
      error: { message: error.message, name: 'Error', stack: expect.any(String) },
      approval: {
        id: inputData.toolCallId,
        approved: true,
      },
      ...inputData,
    });
  });

  it('should carry an approval grant into a later ordinary suspension', async () => {
    const inputData = makeInputData();
    const suspend = vi.fn();
    tools['test-tool'].execute.mockImplementation(async (_args, context) => {
      await context.suspend({ reason: 'need-more-input' });
      return { success: true };
    });

    await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData: { approved: true }, suspendData: makeSuspendData(), suspend }),
    );

    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallResume: expect.objectContaining({
          type: 'suspension',
          toolCallId: inputData.toolCallId,
          approval: { id: inputData.toolCallId, approved: true },
        }),
      }),
      { resumeLabel: inputData.toolCallId },
    );
  });

  it('persists the delegated resume label when a resumed tool suspends again', async () => {
    const inputData = {
      ...makeInputData(),
      toolCallId: 'wrapper-call-id',
      toolName: 'agent-delegate',
      args: {
        param: 'test',
        resumeData: { approved: true },
        suspendedToolCallId: 'original-call-id',
      },
    };
    const suspend = vi.fn();
    tools['agent-delegate'] = tools['test-tool'];
    toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      requireToolApproval: true,
      runId: 'test-run',
      streamState,
    });
    tools['test-tool'].execute.mockImplementation(async (_args, context) => {
      await context.suspend({ reason: 'need-more-input' });
      return { success: true };
    });

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        suspend,
        suspendData: {
          toolCallResume: {
            version: 1,
            originRunId: 'test-run',
            stepId: 'toolCallStep',
            type: 'suspension',
            toolCallId: 'original-call-id',
            toolName: 'agent-delegate',
            identityDigest: createToolCallIdentityDigest({
              toolCallId: 'original-call-id',
              toolName: 'agent-delegate',
              args: { param: 'test' },
            }),
          },
        },
      }),
    );

    expect(result).not.toHaveProperty('error');
    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallResume: expect.objectContaining({ toolCallId: 'original-call-id' }),
        toolCallId: 'original-call-id',
      }),
      { resumeLabel: 'original-call-id' },
    );
  });

  it('keeps user toolCallId payloads separate from delegated suspension coordinates', async () => {
    const inputData = {
      ...makeInputData(),
      toolName: 'agent-delegate',
    };
    tools['agent-delegate'] = tools['test-tool'];
    tools['test-tool'].requireApproval = false;
    const workflowSuspend = vi.fn();
    toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'test-run',
      streamState,
    });
    tools['test-tool'].execute.mockImplementation(async (_args, context) => {
      await context.suspend(
        { toolCallId: 'payload-child-call' },
        { runId: 'child-run', suspendedToolCallId: 'option-child-call', isAgentSuspend: true },
      );
      return { success: true };
    });

    const result = await toolCallStep.execute(makeExecuteParams({ inputData, suspend: workflowSuspend }));

    expect(result).not.toHaveProperty('error');
    expect(workflowSuspend).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallSuspended: { toolCallId: 'payload-child-call' },
        suspendedToolCallId: 'option-child-call',
      }),
      { resumeLabel: inputData.toolCallId },
    );
  });

  it('persists the delegated resume label when a resumed tool requests execution approval', async () => {
    const inputData = {
      ...makeInputData(),
      toolCallId: 'wrapper-call-id',
      toolName: 'agent-delegate',
      args: {
        param: 'test',
        resumeData: { answer: 'continue' },
        suspendedToolCallId: 'original-call-id',
      },
    };
    const suspend = vi.fn();
    tools['agent-delegate'] = tools['test-tool'];
    toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      requireToolApproval: false,
      runId: 'test-run',
      streamState,
    });
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockImplementation(async (_args, context) => {
      await context.suspend({ reason: 'approve-side-effect' }, { requireToolApproval: true });
      return { success: true };
    });

    const result = await toolCallStep.execute(
      makeExecuteParams({
        inputData,
        suspend,
        suspendData: {
          toolCallResume: {
            version: 1,
            originRunId: 'test-run',
            stepId: 'toolCallStep',
            type: 'suspension',
            toolCallId: 'original-call-id',
            toolName: 'agent-delegate',
            identityDigest: createToolCallIdentityDigest({
              toolCallId: 'original-call-id',
              toolName: 'agent-delegate',
              args: { param: 'test' },
            }),
          },
        },
      }),
    );

    expect(result).not.toHaveProperty('error');
    expect(controller.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tool-call-approval',
        payload: expect.objectContaining({ toolCallId: 'original-call-id' }),
      }),
    );
    expect(suspend).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallResume: expect.objectContaining({ toolCallId: 'original-call-id' }),
        requireToolApproval: expect.objectContaining({ toolCallId: 'original-call-id' }),
      }),
      { resumeLabel: 'original-call-id' },
    );
  });

  it('should restore approval provenance after an ordinary suspension resumes', async () => {
    const inputData = makeInputData();
    const suspendData = makeSuspendData('suspension');
    suspendData.toolCallResume.approval = { id: inputData.toolCallId, approved: true };
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockResolvedValue({ success: true });

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData: { answer: 'continue' }, suspendData }),
    );

    expect(result).toEqual({
      result: { success: true },
      approval: { id: inputData.toolCallId, approved: true },
      ...inputData,
      resumedFromSuspension: true,
    });
  });

  it('should pass approved-shaped suspension resumes when approval is not required', async () => {
    const toolResult = { resumed: true };
    tools['test-tool'].requireApproval = false;
    tools['test-tool'].execute.mockResolvedValue(toolResult);
    const inputData = makeInputData();
    const resumeData = { approved: true, editedArgs: { text: 'generic suspension payload' } };

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData, suspendData: makeSuspendData('suspension') }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        resumeData,
      }),
    );
    expect(result).toEqual({
      result: toolResult,
      ...inputData,
      resumedFromSuspension: true,
    });
  });

  it('should clear delegated agent approval metadata when resuming workflow approval data', async () => {
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'agent-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'agent-call-id',
              toolName: 'agent-subAgent',
              args: { prompt: 'lookup' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'agent-call-id',
                toolName: 'agent-subAgent',
                args: { prompt: 'lookup' },
              }),
              type: 'approval',
              runId: 'suspended-agent-run-id',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    const flushMessages = vi.fn();
    const agentTool = {
      execute: vi.fn().mockResolvedValue({ text: 'declined' }),
      requireApproval: false,
    };
    const step = createToolCallStep({
      tools: { 'agent-subAgent': agentTool },
      messageList: {
        get: {
          input: { aiV5: { model: () => [] } },
          response: { db: () => [] },
          all: { db: () => [assistantMessage], aiV5: { model: () => [] } },
        },
      } as unknown as MessageList,
      controller,
      runId: 'test-run',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        threadId: 'thread-id',
      },
    } as any);

    const inputData = {
      toolCallId: 'agent-call-id',
      toolName: 'agent-subAgent',
      args: { prompt: 'lookup' },
    };
    const requestContext = new RequestContext();
    requestContext.set('__mastra_requireToolApproval', true);

    const result = await step.execute(
      makeExecuteParams({
        inputData,
        requestContext,
        resumeData: { approved: false },
        writer: new ToolStream({
          prefix: 'tool',
          callId: 'agent-call-id',
          name: 'agent-subAgent',
          runId: 'test-run-id',
        }),
      }),
    );

    expect(agentTool.execute).toHaveBeenCalledWith(
      {
        prompt: 'lookup',
        resourceId: undefined,
        suspendedToolRunId: 'suspended-agent-run-id',
        threadId: 'thread-id',
      },
      expect.objectContaining({
        resumeData: { approved: false },
      }),
    );
    expect(assistantMessage.content.metadata.pendingToolApprovals).toBeUndefined();
    expect(flushMessages).toHaveBeenCalled();
    expect(result).toEqual({
      result: { text: 'declined' },
      ...inputData,
    });
  });

  it('should reject a delegated decline with a mismatched suspended run ID', async () => {
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'agent-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'agent-call-id',
              toolName: 'agent-subAgent',
              args: { prompt: 'lookup' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'agent-call-id',
                toolName: 'agent-subAgent',
                args: { prompt: 'lookup' },
              }),
              type: 'approval',
              runId: 'suspended-agent-run-id',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    const agentTool = {
      execute: vi.fn(),
      requireApproval: false,
    };
    const step = createToolCallStep({
      tools: { 'agent-subAgent': agentTool },
      messageList: {
        get: {
          input: { aiV5: { model: () => [] } },
          response: { db: () => [] },
          all: { db: () => [assistantMessage], aiV5: { model: () => [] } },
        },
      } as unknown as MessageList,
      controller,
      runId: 'test-run',
      streamState,
    } as any);
    const inputData = {
      toolCallId: 'agent-resume-call-id',
      toolName: 'agent-subAgent',
      args: {
        prompt: 'lookup',
        resumeData: { approved: false },
        suspendedToolCallId: 'agent-call-id',
        suspendedToolRunId: 'wrong-agent-run-id',
      },
    };

    const result = await step.execute(makeExecuteParams({ inputData }));

    expect(result).toEqual({ ...inputData, error: expect.any(Error) });
    expect(result.error.message).toBe('Tool resume evidence did not match the suspended tool call');
    expect(agentTool.execute).not.toHaveBeenCalled();
    expect(assistantMessage.content.metadata.pendingToolApprovals).toBeDefined();
  });

  it('should not pass local agent approval resume data to the delegated tool wrapper', async () => {
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          pendingToolApprovals: {
            'agent-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'agent-call-id',
              toolName: 'agent-subAgent',
              args: { prompt: 'lookup' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'agent-call-id',
                toolName: 'agent-subAgent',
                args: { prompt: 'lookup' },
              }),
              type: 'approval',
              runId: 'test-run',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    const flushMessages = vi.fn();
    const agentTool = {
      execute: vi.fn().mockResolvedValue({ text: 'approved' }),
      requireApproval: false,
    };
    const step = createToolCallStep({
      tools: { 'agent-subAgent': agentTool },
      messageList: {
        get: {
          input: { aiV5: { model: () => [] } },
          response: { db: () => [] },
          all: { db: () => [assistantMessage], aiV5: { model: () => [] } },
        },
      } as unknown as MessageList,
      controller,
      runId: 'test-run',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        threadId: 'thread-id',
      },
    } as any);
    const requestContext = new RequestContext();
    requestContext.set('__mastra_requireToolApproval', true);

    await step.execute(
      makeExecuteParams({
        inputData: {
          toolCallId: 'agent-call-id',
          toolName: 'agent-subAgent',
          args: { prompt: 'lookup' },
        },
        requestContext,
        resumeData: { approved: true },
        writer: new ToolStream({
          prefix: 'tool',
          callId: 'agent-call-id',
          name: 'agent-subAgent',
          runId: 'test-run-id',
        }),
      }),
    );

    expect(agentTool.execute).toHaveBeenCalledOnce();
    const [, toolOptions] = agentTool.execute.mock.calls[0]!;
    expect(toolOptions.resumeData).toBeUndefined();
    expect(assistantMessage.content.metadata.pendingToolApprovals).toBeUndefined();
  });

  it('should clear delegated agent suspension metadata when resume data contains approved', async () => {
    const assistantMessage = {
      role: 'assistant',
      content: {
        metadata: {
          suspendedTools: {
            'agent-call-id': {
              version: 1,
              originRunId: 'test-run',
              stepId: 'toolCallStep',
              toolCallId: 'agent-call-id',
              toolName: 'agent-subAgent',
              args: { prompt: 'lookup' },
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'agent-call-id',
                toolName: 'agent-subAgent',
                args: { prompt: 'lookup' },
              }),
              type: 'suspension',
              runId: 'suspended-agent-run-id',
              resumeSchema: '{}',
            },
          },
        },
        parts: [],
      },
    };
    const flushMessages = vi.fn();
    const agentTool = {
      execute: vi.fn().mockResolvedValue({ text: 'resumed' }),
      requireApproval: true,
    };
    const step = createToolCallStep({
      tools: { 'agent-subAgent': agentTool },
      messageList: {
        get: {
          input: { aiV5: { model: () => [] } },
          response: { db: () => [] },
          all: { db: () => [assistantMessage], aiV5: { model: () => [] } },
        },
      } as unknown as MessageList,
      controller,
      runId: 'test-run',
      streamState,
      _internal: {
        saveQueueManager: { flushMessages },
        threadId: 'thread-id',
      },
    } as any);

    const inputData = {
      toolCallId: 'agent-resume-call-id',
      toolName: 'agent-subAgent',
      args: {
        prompt: 'lookup',
        resumeData: { approved: false },
        suspendedToolCallId: 'agent-call-id',
        suspendedToolRunId: 'suspended-agent-run-id',
      },
    };

    const result = await step.execute(
      makeExecuteParams({
        inputData,
        writer: new ToolStream({
          prefix: 'tool',
          callId: 'agent-resume-call-id',
          name: 'agent-subAgent',
          runId: 'test-run-id',
        }),
      }),
    );

    expect(agentTool.execute).toHaveBeenCalledWith(
      {
        prompt: 'lookup',
        resourceId: undefined,
        suspendedToolRunId: 'suspended-agent-run-id',
        threadId: 'thread-id',
      },
      expect.objectContaining({
        resumeData: { approved: false },
      }),
    );
    expect(assistantMessage.content.metadata.suspendedTools).toBeUndefined();
    expect(flushMessages).toHaveBeenCalled();
    expect(result).toEqual({
      result: { text: 'resumed' },
      ...inputData,
      resumeTargetToolCallId: 'agent-call-id',
      resumedFromSuspension: true,
    });
  });

  it('carries a caller-supplied decline reason onto the approval decision (#20495)', async () => {
    const inputData = makeInputData();
    const resumeData = { approved: false, reason: 'The user is not authorized to read this file' };

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData, suspendData: makeSuspendData() }),
    );

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
      makeExecuteParams({
        inputData,
        resumeData: { approved: false, reason: '   ' },
        suspendData: makeSuspendData(),
      }),
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

  it('advertises edited arguments only for validated object schemas', async () => {
    const approvalSchemaFor = async (inputSchema: any, args: unknown) => {
      const execute = vi.fn();
      const builtTool = new CoreToolBuilder({
        originalTool: {
          id: 'test-tool',
          description: 'Approval schema tool',
          inputSchema,
          execute,
        } as any,
        options: {
          name: 'test-tool',
          description: 'Approval schema tool',
          requestContext: new RequestContext(),
          logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
        },
      }).build();
      const step = createToolCallStep({
        tools: { 'test-tool': builtTool },
        messageList,
        controller,
        requireToolApproval: true,
        runId: 'test-run',
        streamState,
      } as any);

      controller.enqueue.mockClear();
      suspend.mockResolvedValueOnce('suspended');
      await step.execute(makeExecuteParams({ inputData: { ...makeInputData(), args } }));
      const approvalChunk = controller.enqueue.mock.calls
        .map(([chunk]: [any]) => chunk)
        .find((chunk: any) => chunk?.type === 'tool-call-approval');
      expect(approvalChunk).toBeDefined();
      return { resumeSchema: JSON.parse(approvalChunk.payload.resumeSchema), builtTool, execute };
    };

    const { resumeSchema: primitiveSchema } = await approvalSchemaFor(z.string(), 'review me');
    expect(primitiveSchema.properties).not.toHaveProperty('editedArgs');

    const { resumeSchema: optionalObjectSchema } = await approvalSchemaFor(
      z.object({ note: z.string().optional() }),
      null,
    );
    expect(optionalObjectSchema.properties.editedArgs).toBeDefined();

    const { resumeSchema: unvalidatedJsonSchema } = await approvalSchemaFor(
      { type: 'object', properties: { note: { type: 'string' } } },
      { note: 'review me' },
    );
    expect(unvalidatedJsonSchema.properties).not.toHaveProperty('editedArgs');

    const { resumeSchema: passThroughAiSdkSchema } = await approvalSchemaFor(
      toStandardSchema(jsonSchema({ type: 'object', properties: { note: { type: 'string' } } })),
      { note: 'review me' },
    );
    expect(passThroughAiSdkSchema.properties).not.toHaveProperty('editedArgs');

    const validate = vi.fn((value: unknown) =>
      typeof (value as { note?: unknown })?.note === 'string'
        ? { success: true as const, value: { note: (value as { note: string }).note.trim() } }
        : { success: false as const, error: new Error('note must be a string') },
    );
    const validatedAiSdk = await approvalSchemaFor(
      jsonSchema({ type: 'object', properties: { note: { type: 'string' } } }, { validate }),
      { note: 'review me' },
    );
    expect(validatedAiSdk.resumeSchema.properties.editedArgs).toBeDefined();
    const validation = await (validatedAiSdk.builtTool as any).validateInput({ note: 42 });
    expect(validation.error).toBeTruthy();
    const executionResult = await validatedAiSdk.builtTool.execute?.({ note: 42 } as any, {} as any);
    expect(executionResult).toMatchObject({ error: true });
    expect(validatedAiSdk.execute).not.toHaveBeenCalled();
    await validatedAiSdk.builtTool.execute?.({ note: '  reviewed  ' } as any, {} as any);
    expect(validatedAiSdk.execute).toHaveBeenCalledWith({ note: 'reviewed' }, expect.any(Object));
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

    const result = await toolCallStep.execute(
      makeExecuteParams({ inputData, resumeData, suspendData: makeSuspendData() }),
    );

    expect(tools['test-tool'].execute).toHaveBeenCalledWith(
      inputData.args,
      expect.objectContaining({
        toolCallId: inputData.toolCallId,
        messages: [],
        resumeData: undefined,
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

  // Fork contract (PF resume-identity hardening): a `suspendedTools` entry is only honoured as
  // resume evidence when it carries the full identity envelope — version/originRunId/type/stepId/
  // toolCallId/toolName plus a digest over the canonical args. A pre-identity entry is treated as
  // a mismatch and the step fails closed, so these fixtures must be identity-bearing to reach the
  // cleanup path upstream is pinning here.
  const createSuspendedAssistantMessage = (
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown> = { prompt: 'do thing' },
  ) => ({
    id: 'assistant-suspended',
    role: 'assistant' as const,
    createdAt: new Date(0),
    content: {
      format: 2 as const,
      metadata: {
        suspendedTools: {
          [toolCallId]: {
            version: 1,
            originRunId: 'parent-run-id',
            stepId: 'toolCallStep',
            type: 'suspension',
            toolCallId,
            toolName,
            args,
            identityDigest: createToolCallIdentityDigest({ toolCallId, toolName, args }),
            runId: 'parent-run-id',
          },
        },
      } as Record<string, unknown>,
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocation: { state: 'call' as const, toolCallId, toolName, args },
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
    execute,
  }: {
    resumeData?: unknown;
    args: Record<string, unknown>;
    message: ReturnType<typeof createSuspendedAssistantMessage>;
    flushMessages: Mock;
    suspendData?: unknown;
    toolCallId?: string;
    execute?: Mock;
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
        execute: execute ?? vi.fn(async () => ({ confirmed: true })),
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
    // clears its own metadata. The generic suspension cleanup must not also run here — metadata
    // deletion is call-ID scoped precisely so it cannot delete the entry belonging to a
    // different, still-suspended call of the same tool.
    // The decision is delivered as workflow resumeData with an authoritative `toolCallResume`
    // envelope: that is the only trusted consent path, and without it the step fails closed
    // before the approval branch and the assertion below would hold vacuously.
    const message = createSuspendedAssistantMessage('sibling-call-id', 'hitl-tool');
    const flushMessages = vi.fn();
    const execute = vi.fn(async () => ({ confirmed: true }));

    const result = await runResumedTool({
      toolCallId: 'approved-call-id',
      resumeData: { approved: true },
      suspendData: {
        requireToolApproval: true,
        toolCallResume: {
          version: 1,
          originRunId: 'parent-run-id',
          stepId: 'toolCallStep',
          type: 'approval',
          approvalSource: 'tool-gate',
          toolCallId: 'approved-call-id',
          toolName: 'hitl-tool',
          identityDigest: createToolCallIdentityDigest({
            toolCallId: 'approved-call-id',
            toolName: 'hitl-tool',
            args: { prompt: 'do thing' },
          }),
        },
      },
      args: { prompt: 'do thing' },
      message,
      flushMessages,
      execute,
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(result.approval).toEqual({ id: 'approved-call-id', approved: true });
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
              version: 1,
              originRunId: 'parent-run-id',
              stepId: 'toolCallStep',
              type: 'suspension',
              toolCallId: 'wf-call-id',
              toolName: 'workflow-sub',
              args: {},
              identityDigest: createToolCallIdentityDigest({
                toolCallId: 'wf-call-id',
                toolName: 'workflow-sub',
                args: {},
              }),
              // The outer resumable run; `delegatedRunId` carries the delegate's inner run, which
              // is what the wrapper must hand back as `suspendedToolRunId`.
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

  it('should skip approval when only needsApprovalFn returns false', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    const toolResult = { deleted: true };
    const tools = {
      'ctx-tool': {
        execute: vi.fn().mockResolvedValue(toolResult),
        requireApproval: false,
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

  it('should skip approval when needsApprovalFn returns false despite requireApproval true (#17337 precedence)', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
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
      runId: 'static-approval-run-id',
      streamState,
    });

    const executePromise = toolCallStep.execute(makeExecuteParams());

    await new Promise(resolve => setImmediate(resolve));

    expect(needsApprovalFn).toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
    expect(tools['ctx-tool'].execute).toHaveBeenCalled();

    await executePromise;
  });

  it('should skip approval when needsApprovalFn returns false despite global requireToolApproval true (#17337 precedence)', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    const tools = {
      'ctx-tool': {
        execute: vi.fn(),
        requireApproval: false,
        needsApprovalFn,
      },
    };

    const toolCallStep = createToolCallStep({
      tools,
      messageList,
      controller,
      runId: 'global-approval-run-id',
      streamState,
    });
    const requestContext = new RequestContext();
    requestContext.set('__mastra_requireToolApproval', true);

    const executePromise = toolCallStep.execute(makeExecuteParams({ requestContext }));

    await new Promise(resolve => setImmediate(resolve));

    expect(needsApprovalFn).toHaveBeenCalled();
    expect(suspend).not.toHaveBeenCalled();
    expect(tools['ctx-tool'].execute).toHaveBeenCalled();

    await executePromise;
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

  const makeFgaProvider = () => ({
    require: vi.fn().mockResolvedValue(undefined),
    check: vi.fn(),
    filterAccessible: vi.fn(),
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

  it('forwards a trusted actor through the FGA precheck and tool invocation', async () => {
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-1');
    const actor = { actorKind: 'system', sourceWorkflow: 'nightly-workflow' } as const;
    const fgaProvider = makeFgaProvider();
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
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
      agentId: 'agent-1',
      actor,
      mastra: mastra as any,
    } as any);

    await toolCallStep.execute(makeExecuteParams({ requestContext }));

    expect(fgaProvider.require).not.toHaveBeenCalled();
    expect(capturedOptions?.actor).toBe(actor);
  });

  it('uses one converted identity and the authoritative live principal for channel tools', async () => {
    const requestContext = new RequestContext();
    const user = { id: 'channel-user', canAuthorize: vi.fn().mockReturnValue(true) };
    requestContext.set('user', user);
    const executionRequestContext = new RequestContext();
    const projectedUser = JSON.parse(JSON.stringify(user));
    executionRequestContext.set('user', projectedUser);
    expect(projectedUser.canAuthorize).toBeUndefined();
    const fgaProvider = makeFgaProvider();
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const channelTool = createTool({
      id: 'channel-tool',
      description: 'Channel tool',
      inputSchema: z.object({ key: z.string() }),
      execute: async () => ({ ok: true }),
    });
    const builtChannelTool = new CoreToolBuilder({
      originalTool: channelTool,
      options: {
        name: 'channel-tool',
        requestContext,
        mastra: mastra as any,
      },
    }).build();
    const inputData = { ...makeInputData(), toolName: 'channel-tool' };

    const toolCallStep = createToolCallStep({
      tools: { 'channel-tool': builtChannelTool },
      messageList,
      controller,
      runId: 'ctx-run',
      streamState,
      agentId: 'agent-1',
      mastra: mastra as any,
    } as any);

    await toolCallStep.execute(makeExecuteParams({ inputData, requestContext: executionRequestContext }));

    expect(fgaProvider.require).toHaveBeenCalledTimes(1);
    expect(fgaProvider.require).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ resource: { type: 'tool', id: 'channel-tool' } }),
    );
  });

  it('authorizes a converted browser tool with its canonical identity when its builder has no FGA provider', async () => {
    const requestContext = new RequestContext();
    const user = { id: 'browser-user' };
    requestContext.set('user', user);
    const fgaProvider = makeFgaProvider();
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const browserTool = createTool({
      id: 'browser-click',
      description: 'Click in the browser',
      inputSchema: z.object({ key: z.string() }),
      execute: async () => ({ ok: true }),
    });
    const builtBrowserTool = new CoreToolBuilder({
      originalTool: browserTool,
      options: {
        name: 'browser-click',
        agentId: 'agent-1',
        requestContext,
        mastra: undefined,
      },
    }).build();
    const inputData = { ...makeInputData(), toolName: 'browser-click' };

    const toolCallStep = createToolCallStep({
      tools: { 'browser-click': builtBrowserTool },
      messageList,
      controller,
      runId: 'ctx-run',
      streamState,
      agentId: 'agent-1',
      mastra: mastra as any,
    } as any);

    await toolCallStep.execute(makeExecuteParams({ inputData, requestContext }));

    expect(fgaProvider.require).toHaveBeenCalledTimes(1);
    expect(fgaProvider.require).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ resource: { type: 'tool', id: 'agent-1:browser-click' } }),
    );
  });

  it.each([
    {
      shape: 'own forged marker and MCP-like metadata',
      createRawTool: () => ({
        inputSchema: z.object({ key: z.string() }),
        mcpMetadata: { serverName: 'untrusted-metadata' },
        _mastraFgaResourceId: 'victim-agent:ctx-tool',
        execute: vi.fn().mockResolvedValue({ ok: true }),
      }),
    },
    {
      shape: 'inherited forged marker',
      createRawTool: () =>
        Object.assign(Object.create({ _mastraFgaResourceId: 'victim-agent:ctx-tool' }), {
          inputSchema: z.object({ key: z.string() }),
          execute: vi.fn().mockResolvedValue({ ok: true }),
        }),
    },
  ])('keeps a raw AI SDK tool with $shape on the standalone identity', async ({ createRawTool }) => {
    const requestContext = new RequestContext();
    const user = { id: 'sdk-user' };
    requestContext.set('user', user);
    const fgaProvider = makeFgaProvider();
    const mastra = { getServer: () => ({ fga: fgaProvider }) };

    const toolCallStep = createToolCallStep({
      tools: { 'ctx-tool': createRawTool() },
      messageList,
      controller,
      runId: 'ctx-run',
      streamState,
      agentId: 'agent-1',
      mastra: mastra as any,
    } as any);

    await toolCallStep.execute(makeExecuteParams({ requestContext }));

    expect(fgaProvider.require).toHaveBeenCalledTimes(1);
    expect(fgaProvider.require).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ resource: { type: 'tool', id: 'ctx-tool' } }),
    );
  });

  it('uses one selected identity for locally executed provider-defined tools', async () => {
    const requestContext = new RequestContext();
    const user = { id: 'provider-user' };
    requestContext.set('user', user);
    const fgaProvider = makeFgaProvider();
    const mastra = { getServer: () => ({ fga: fgaProvider }) };
    const providerTool = {
      type: 'provider-defined' as const,
      id: 'provider.search' as const,
      description: 'Provider search',
      inputSchema: z.object({ key: z.string() }),
      execute: vi.fn().mockResolvedValue({ ok: true }),
    };
    const builtProviderTool = new CoreToolBuilder({
      originalTool: providerTool as any,
      options: {
        name: 'provider-search',
        agentId: 'agent-1',
        requestContext,
        mastra: mastra as any,
      },
    }).build();
    const inputData = { ...makeInputData(), toolName: 'provider-search' };

    const toolCallStep = createToolCallStep({
      tools: { 'provider-search': builtProviderTool },
      messageList,
      controller,
      runId: 'ctx-run',
      streamState,
      agentId: 'agent-1',
      mastra: mastra as any,
    } as any);

    await toolCallStep.execute(makeExecuteParams({ inputData, requestContext }));

    expect(fgaProvider.require).toHaveBeenCalledTimes(1);
    expect(fgaProvider.require).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ resource: { type: 'tool', id: 'agent-1:provider-search' } }),
    );
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

describe('createToolCallStep onBeforeToolExecution boundaries', () => {
  it('does not dispatch the tool when the request aborts while the awaited hook runs', async () => {
    const abortController = new AbortController();
    const toolExecute = vi.fn().mockResolvedValue({ wrote: true });
    const requestContext = new RequestContext();
    requestContext.set(ON_BEFORE_TOOL_EXECUTION_KEY, async () => {
      abortController.abort();
      return 'allow';
    });

    const step = createToolCallStep({
      tools: { write_file: { execute: toolExecute } } as any,
      messageList: createMessageList(),
      controller: { enqueue: vi.fn() },
      runId: 'run-abort-gate',
      streamState: { serialize: () => ({}) } as any,
      options: { abortSignal: abortController.signal },
    } as any);

    const result = await step.execute(
      makeBaseExecuteParams(vi.fn(), {
        requestContext,
        inputData: { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.txt' } },
      }),
    );

    expect(toolExecute).not.toHaveBeenCalled();
    expect(result).toMatchObject({ aborted: true });
  });

  it('revalidates on each background attempt; a mid-flight revocation denies the retry', async () => {
    let granted = true;
    const hookInputs: Array<{ toolName?: string; isResume?: boolean }> = [];
    const requestContext = new RequestContext();
    requestContext.set(ON_BEFORE_TOOL_EXECUTION_KEY, async (input: any) => {
      hookInputs.push(input);
      return granted ? 'allow' : 'deny';
    });
    requestContext.set(ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY, true);

    const toolExecute = vi.fn(async () => {
      // The grant is revoked while attempt 1 is in flight; attempt 1 then fails.
      granted = false;
      throw new Error('transient failure');
    });
    let bgContext: any;
    const backgroundTaskManager = {
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
      enqueue: vi.fn(async (_payload: any, context: any) => {
        bgContext = context;
        return { task: { id: 'task-1' }, fallbackToSync: false };
      }),
      registerTaskContext: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
    };
    const step = createToolCallStep({
      tools: {
        write_file: {
          backgroundConfig: { enabled: true, maxRetries: 1 },
          execute: toolExecute,
        },
      } as any,
      messageList: createMessageList(),
      controller: { enqueue: vi.fn() },
      runId: 'run-bg-gate',
      streamState: { serialize: () => ({}) } as any,
      requestContext,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await step.execute(
      makeBaseExecuteParams(vi.fn(), {
        requestContext,
        inputData: { toolCallId: 'call-1', toolName: 'write_file', args: { path: 'a.txt' } },
      }),
    );
    expect(bgContext?.executor?.execute).toBeTypeOf('function');

    // Attempt 1 — revalidated (grant still held), executes, fails transiently.
    await expect(bgContext.executor.execute({ path: 'a.txt' })).rejects.toThrow('transient failure');
    expect(toolExecute).toHaveBeenCalledTimes(1);

    // Attempt 2 — grant revoked in between: revalidation denies before any
    // side effect, with the name the bg-task workflow classifies non-retryable.
    await expect(bgContext.executor.execute({ path: 'a.txt' })).rejects.toMatchObject({
      name: TOOL_PERMISSION_DENIED_ERROR_NAME,
    });
    expect(toolExecute).toHaveBeenCalledTimes(1);
    // Dispatch gate + attempt 1 + attempt 2.
    expect(hookInputs).toHaveLength(3);
  });

  it('persists the hook requirement on the task and reports the step-level resume to attempt hooks', async () => {
    const hookInputs: Array<{ isResume?: boolean }> = [];
    const requestContext = new RequestContext();
    requestContext.set(ON_BEFORE_TOOL_EXECUTION_KEY, async (input: any) => {
      hookInputs.push(input);
      return 'allow';
    });

    let bgContext: any;
    const enqueuePayloads: any[] = [];
    const backgroundTaskManager = {
      // No suspended task — this resume turn dispatches a fresh background task.
      listTasks: vi.fn(async () => ({ tasks: [], total: 0 })),
      enqueue: vi.fn(async (payload: any, context: any) => {
        enqueuePayloads.push(payload);
        bgContext = context;
        return { task: { id: 'task-1' }, fallbackToSync: false };
      }),
      registerTaskContext: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      waitForNextTask: vi.fn(),
    };
    const step = createToolCallStep({
      tools: {
        'background-tool': {
          backgroundConfig: { enabled: true },
          execute: vi.fn(async () => ({ ok: true })),
        },
      } as any,
      messageList: createMessageList(),
      controller: { enqueue: vi.fn() },
      runId: 'current-run',
      streamState: { serialize: () => ({}) } as any,
      requestContext,
      _internal: {
        backgroundTaskManager,
        backgroundTaskManagerConfig: { enabled: true },
        agentBackgroundConfig: { tools: 'all' },
      },
    } as any);

    await step.execute(
      makeBaseExecuteParams(vi.fn(), {
        requestContext,
        resumeData: { answer: 'continue' },
        suspendData: {
          toolCallResume: {
            version: 1,
            originRunId: 'current-run',
            stepId: 'toolCallStep',
            type: 'suspension',
            toolCallId: 'call-1',
            toolName: 'background-tool',
            identityDigest: createToolCallIdentityDigest({
              toolCallId: 'call-1',
              toolName: 'background-tool',
              args: { query: 'customers' },
            }),
          },
        },
        inputData: { toolCallId: 'call-1', toolName: 'background-tool', args: { query: 'customers' } },
      }),
    );

    // The hook closure cannot survive recovery — the requirement persists on
    // the task so a statically-resolved executor fails closed instead.
    expect(enqueuePayloads[0]?.requiresToolPermissionHook).toBe(true);
    expect(bgContext?.executor?.execute).toBeTypeOf('function');

    // First attempt carries no resumeData of its own, but the step-level
    // suspension resume still reaches the hook.
    hookInputs.length = 0;
    await bgContext.executor.execute({ query: 'customers' });
    expect(hookInputs[0]?.isResume).toBe(true);
  });
});
