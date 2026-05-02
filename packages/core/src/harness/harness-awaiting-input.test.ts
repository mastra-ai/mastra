import { describe, expect, it, vi } from 'vitest';
import z from 'zod';

import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage';
import { MastraLanguageModelV2Mock } from '../test-utils/llm-mock';
import { createTool } from '../tools';
import type { WorkflowRunState } from '../workflows';

import { Harness } from './harness';

vi.setConfig({ testTimeout: 30_000 });

function createToolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'confirmAction',
        input: '{"action":"deploy"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createAskUserToolCallStream({
  question = 'Continue?',
  options,
  selectionMode,
}: {
  question?: string;
  options?: Array<{ label: string; description?: string }>;
  selectionMode?: 'single_select' | 'multi_select';
} = {}) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-ask',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'ask-call',
        toolName: 'ask_user',
        input: JSON.stringify({
          question,
          ...(options ? { options } : {}),
          ...(selectionMode ? { selectionMode } : {}),
        }),
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createSubmitPlanToolCallStream({ title = 'Implementation Plan', plan = '# Plan' } = {}) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-plan',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'plan-call',
        toolName: 'submit_plan',
        input: JSON.stringify({ title, plan }),
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-1',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Done.' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function* createHarnessTextFullStream(runId: string) {
  yield { type: 'text-start', runId, payload: { id: 'text-1' } };
  yield { type: 'text-delta', runId, payload: { id: 'text-1', text: 'Approved.' } };
  yield { type: 'text-end', runId, payload: { id: 'text-1' } };
  yield { type: 'finish', runId, payload: { stepResult: { reason: 'stop' } } };
}

async function* createApprovalFullStream({
  runId = 'approval-run',
  toolCallIds = ['approval-call'],
  afterApproval,
}: {
  runId?: string;
  toolCallIds?: string[];
  afterApproval?: () => Promise<void> | void;
} = {}) {
  for (const toolCallId of toolCallIds) {
    yield {
      type: 'tool-call-approval',
      runId,
      payload: {
        toolCallId,
        toolName: 'writeFile',
        args: { path: 'README.md' },
      },
    };
  }
  await afterApproval?.();
  yield { type: 'finish', runId, payload: { stepResult: { reason: 'stop' } } };
}

function createSuspendedSnapshot({
  runId,
  toolCallId,
  suspendPayload,
  threadId = 'thread-1',
  resourceId = 'resource-1',
}: {
  runId: string;
  toolCallId: string;
  suspendPayload: Record<string, unknown>;
  threadId?: string;
  resourceId?: string;
}): WorkflowRunState {
  return {
    runId,
    status: 'suspended',
    value: {},
    context: {
      input: {
        state: {
          threadId,
          resourceId,
        },
      },
      'tool-call': {
        status: 'suspended',
        suspendPayload,
      },
    },
    activePaths: [],
    activeStepsPath: {},
    serializedStepGraph: [],
    suspendedPaths: { 'tool-call': [] },
    resumeLabels: { [toolCallId]: { stepId: 'tool-call' } },
    waitingPaths: {},
    timestamp: Date.now(),
  } as WorkflowRunState;
}

describe('Harness awaiting input durability', () => {
  it('discovers a durable tool suspension and resumes it from a fresh harness', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) {
          return { result: `Action "${input.action}" confirmed`, resumed: resumeData };
        }

        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action }, { resumeSchema: '{"type":"object"}' });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'awaiting-input-agent',
      name: 'Awaiting Input Agent',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'awaiting-input-agent': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('awaiting-input-agent');

    const firstHarness = new Harness({
      id: 'awaiting-input-harness-1',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await firstHarness.init();
    await firstHarness.createThread();
    await firstHarness.sendMessage({ content: 'Deploy to production' });

    const awaitingInput = await firstHarness.waitForAwaitingInputReady({ id: 'call-1' });
    expect(awaitingInput).toMatchObject({
      id: 'call-1',
      kind: 'tool_suspension',
      durable: true,
      toolCallId: 'call-1',
      toolName: 'confirmAction',
      args: { action: 'deploy' },
      suspendPayload: { action: 'deploy' },
    });
    expect(awaitingInput?.runId).toBeDefined();

    const freshHarness = new Harness({
      id: 'awaiting-input-harness-1',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: false } as any,
    });
    await freshHarness.init();

    const result = await freshHarness.resumeAwaitingInput({
      id: 'call-1',
      resumeData: { confirmed: true },
    });

    expect(result.status).toBe('resumed');
    expect(result.suspended).toBeUndefined();

    const repeated = await freshHarness.resumeAwaitingInput({
      id: 'call-1',
      resumeData: { confirmed: true },
    });
    expect(repeated.status).toBe('already_resolved');
  });

  it('discovers a durable ask_user question and resumes it from a fresh harness', async () => {
    const agent = new Agent({
      id: 'durable-question-agent',
      name: 'Durable Question Agent',
      instructions: 'You ask questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return {
              stream:
                callCount === 1
                  ? createAskUserToolCallStream({
                      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
                      selectionMode: 'multi_select',
                    })
                  : createTextStream(),
            };
          };
        })(),
      }),
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'durable-question-agent': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('durable-question-agent');

    const firstHarness = new Harness({
      id: 'durable-question-harness',
      resourceId: 'question-resource',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await firstHarness.init();
    await firstHarness.createThread();
    await firstHarness.sendMessage({ content: 'Ask before continuing' });

    const [question] = await firstHarness.listAwaitingInputs();
    expect(question).toMatchObject({
      kind: 'question',
      durable: true,
      runId: expect.any(String),
      resourceId: 'question-resource',
      questionId: question!.id,
      question: 'Continue?',
      options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      selectionMode: 'multi_select',
    });
    expect(question!.questionId).toMatch(/^q_/);
    expect(question!.questionId).not.toBe('ask-call');

    const freshHarness = new Harness({
      id: 'durable-question-harness',
      resourceId: 'question-resource',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await freshHarness.init();

    const result = await freshHarness.resumeAwaitingInput({
      id: question!.id,
      resumeData: ['A', 'C'],
    });

    expect(result.status).toBe('resumed');

    const repeated = await freshHarness.resumeAwaitingInput({
      id: question!.id,
      resumeData: ['A', 'C'],
    });
    expect(repeated.status).toBe('already_resolved');
  });

  it('discovers a durable submit_plan approval and resumes approved from a fresh harness', async () => {
    const agent = new Agent({
      id: 'durable-plan-agent',
      name: 'Durable Plan Agent',
      instructions: 'You submit plans.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createSubmitPlanToolCallStream() : createTextStream() };
          };
        })(),
      }),
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'durable-plan-agent': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('durable-plan-agent');

    const firstHarness = new Harness({
      id: 'durable-plan-harness',
      resourceId: 'plan-resource',
      storage,
      modes: [
        { id: 'build', name: 'Build', default: true, agent: registeredAgent },
        { id: 'plan', name: 'Plan', agent: registeredAgent },
      ],
      initialState: { yolo: true } as any,
    });
    await firstHarness.init();
    await firstHarness.switchMode({ modeId: 'plan' });
    await firstHarness.createThread();
    await firstHarness.sendMessage({ content: 'Submit the plan' });

    const [plan] = await firstHarness.listAwaitingInputs();
    expect(plan).toMatchObject({
      kind: 'plan_approval',
      durable: true,
      runId: expect.any(String),
      modeId: 'plan',
      resourceId: 'plan-resource',
      planId: plan!.id,
      title: 'Implementation Plan',
      plan: '# Plan',
    });
    expect(plan!.planId).toMatch(/^plan_/);
    expect(plan!.planId).not.toBe('plan-call');

    const freshHarness = new Harness({
      id: 'durable-plan-harness',
      resourceId: 'plan-resource',
      storage,
      modes: [
        { id: 'build', name: 'Build', default: true, agent: registeredAgent },
        { id: 'plan', name: 'Plan', agent: registeredAgent },
      ],
      initialState: { yolo: true } as any,
    });
    await freshHarness.init();

    const result = await freshHarness.resumeAwaitingInput({
      id: plan!.id,
      resumeData: { action: 'approved' },
    });

    expect(result.status).toBe('resumed');
    expect(freshHarness.getCurrentModeId()).toBe('build');

    const repeated = await freshHarness.resumeAwaitingInput({
      id: plan!.id,
      resumeData: { action: 'approved' },
    });
    expect(repeated.status).toBe('already_resolved');
  });

  it('resumes a durable submit_plan rejection with feedback from a fresh harness', async () => {
    const agent = new Agent({
      id: 'durable-plan-rejection-agent',
      name: 'Durable Plan Rejection Agent',
      instructions: 'You submit plans.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createSubmitPlanToolCallStream() : createTextStream() };
          };
        })(),
      }),
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'durable-plan-rejection-agent': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('durable-plan-rejection-agent');

    const firstHarness = new Harness({
      id: 'durable-plan-rejection-harness',
      resourceId: 'plan-rejection-resource',
      storage,
      modes: [
        { id: 'build', name: 'Build', default: true, agent: registeredAgent },
        { id: 'plan', name: 'Plan', agent: registeredAgent },
      ],
      initialState: { yolo: true } as any,
    });
    await firstHarness.init();
    await firstHarness.switchMode({ modeId: 'plan' });
    await firstHarness.createThread();
    await firstHarness.sendMessage({ content: 'Submit the plan' });

    const [plan] = await firstHarness.listAwaitingInputs();
    expect(plan).toMatchObject({
      kind: 'plan_approval',
      durable: true,
      runId: expect.any(String),
      modeId: 'plan',
      resourceId: 'plan-rejection-resource',
      planId: plan!.id,
      title: 'Implementation Plan',
      plan: '# Plan',
    });

    const freshHarness = new Harness({
      id: 'durable-plan-rejection-harness',
      resourceId: 'plan-rejection-resource',
      storage,
      modes: [
        { id: 'build', name: 'Build', default: true, agent: registeredAgent },
        { id: 'plan', name: 'Plan', agent: registeredAgent },
      ],
      initialState: { yolo: true } as any,
    });
    await freshHarness.init();

    const result = await freshHarness.resumeAwaitingInput({
      id: plan!.id,
      resumeData: { action: 'rejected', feedback: 'Add verification steps.' },
    });

    expect(result.status).toBe('resumed');
    expect(freshHarness.getCurrentModeId()).toBe('plan');

    const repeated = await freshHarness.resumeAwaitingInput({
      id: plan!.id,
      resumeData: { action: 'rejected', feedback: 'Add verification steps.' },
    });
    expect(repeated.status).toBe('already_resolved');
  });

  it('waits for a durable question snapshot before returning live_session_only', async () => {
    const agent = new Agent({
      id: 'durable-question-race-agent',
      name: 'Durable Question Race Agent',
      instructions: 'You ask questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const harness = new Harness({
      id: 'durable-question-race-harness',
      resourceId: 'race-resource',
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    const liveQuestion = {
      id: 'q-race',
      kind: 'question' as const,
      durable: false,
      resourceId: 'race-resource',
      questionId: 'q-race',
      question: 'Continue?',
    };
    const durableQuestion = {
      ...liveQuestion,
      durable: true,
      runId: 'race-run',
    };
    const message = {
      id: 'race-message',
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Resumed.' }],
      createdAt: new Date(),
    };

    vi.spyOn(harness, 'getAwaitingInput').mockResolvedValueOnce(liveQuestion).mockResolvedValueOnce(durableQuestion);
    const waitForAwaitingInputReady = vi.spyOn(harness, 'waitForAwaitingInputReady').mockResolvedValue(durableQuestion);
    const handleToolResumeByRunId = vi.spyOn(harness as any, 'handleToolResumeByRunId').mockResolvedValue({ message });

    const result = await harness.resumeAwaitingInput({
      id: 'q-race',
      resumeData: 'Yes',
    });

    expect(waitForAwaitingInputReady).toHaveBeenCalledWith({ id: 'q-race' });
    expect(handleToolResumeByRunId).toHaveBeenCalledWith({
      runId: 'race-run',
      toolCallId: 'q-race',
      resumeData: 'Yes',
      requestContext: undefined,
      threadId: undefined,
      resourceId: 'race-resource',
      requireToolApproval: undefined,
    });
    expect(result).toMatchObject({
      status: 'resumed',
      awaitingInput: durableQuestion,
      message,
    });
  });

  it('resumes a durable tool approval by id from storage', async () => {
    const storage = new InMemoryStore();
    await storage.init();
    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      throw new Error('Expected workflows store to be available for awaiting-input test setup');
    }

    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'other-workflow',
      runId: 'other-run',
      resourceId: 'resource-1',
      snapshot: createSuspendedSnapshot({
        runId: 'other-run',
        toolCallId: 'approval-call',
        suspendPayload: {
          type: 'approval',
          toolCallId: 'approval-call',
          toolName: 'wrongTool',
          args: { path: 'WRONG.md' },
        },
      }),
      updatedAt: new Date(Date.now() + 10_000),
    });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'approval-run',
      resourceId: 'resource-1',
      snapshot: createSuspendedSnapshot({
        runId: 'approval-run',
        toolCallId: 'approval-call',
        suspendPayload: {
          type: 'approval',
          toolCallId: 'approval-call',
          toolName: 'writeFile',
          args: { path: 'README.md' },
          resumeSchema: '{"type":"object"}',
        },
      }),
    });
    const prototypeShadowSnapshot = createSuspendedSnapshot({
      runId: 'prototype-shadow-run',
      toolCallId: 'shadow-call',
      suspendPayload: {
        type: 'approval',
        toolCallId: 'shadow-call',
        toolName: 'wrongTool',
        args: { path: 'SHADOW.md' },
      },
    });
    prototypeShadowSnapshot.resumeLabels = {};
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'prototype-shadow-run',
      resourceId: 'resource-1',
      snapshot: prototypeShadowSnapshot,
      updatedAt: new Date(Date.now() + 20_000),
    });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'constructor-run',
      resourceId: 'resource-1',
      snapshot: createSuspendedSnapshot({
        runId: 'constructor-run',
        toolCallId: 'constructor',
        suspendPayload: {
          type: 'approval',
          toolCallId: 'constructor',
          toolName: 'writeFile',
          args: { path: 'CONSTRUCTOR.md' },
        },
      }),
    });

    const agent = new Agent({
      id: 'approval-agent',
      name: 'Approval Agent',
      instructions: 'You write files.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const acquireThreadLock = vi.fn();
    const releaseThreadLock = vi.fn();
    const resumeStreamSpy = vi
      .spyOn(agent, 'resumeStream')
      .mockResolvedValue({ fullStream: createHarnessTextFullStream('approval-run') } as any);

    const otherHarness = new Harness({
      id: 'other-approval-harness',
      resourceId: 'other-resource',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await otherHarness.init();
    await expect(otherHarness.getAwaitingInput({ id: 'approval-call' })).resolves.toBeNull();
    await expect(otherHarness.listAwaitingInputs()).resolves.toEqual([]);

    const harness = new Harness({
      id: 'approval-harness',
      resourceId: 'resource-1',
      storage,
      toolCategoryResolver: toolName => (toolName === 'writeFile' ? 'edit' : null),
      threadLock: { acquire: acquireThreadLock, release: releaseThreadLock },
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await harness.init();

    const inheritedKeyInput = await harness.getAwaitingInput({ id: 'constructor' });
    expect(inheritedKeyInput).toMatchObject({
      kind: 'tool_approval',
      durable: true,
      runId: 'constructor-run',
      toolCallId: 'constructor',
      toolName: 'writeFile',
      args: { path: 'CONSTRUCTOR.md' },
    });

    const awaitingInput = await harness.getAwaitingInput({ id: 'approval-call' });
    expect(awaitingInput).toMatchObject({
      kind: 'tool_approval',
      durable: true,
      runId: 'approval-run',
      toolCallId: 'approval-call',
      toolName: 'writeFile',
      args: { path: 'README.md' },
    });

    const result = await harness.resumeAwaitingInput({
      id: 'approval-call',
      resumeData: { decision: 'always_allow_category' },
    });

    expect(result.status).toBe('resumed');
    expect(harness.getSessionGrants().categories).toContain('edit');
    expect(acquireThreadLock).toHaveBeenCalledWith('thread-1');
    expect(releaseThreadLock).not.toHaveBeenCalled();
    expect(resumeStreamSpy).toHaveBeenCalledWith(
      { approved: true },
      expect.objectContaining({
        runId: 'approval-run',
        toolCallId: 'approval-call',
        requireToolApproval: true,
        memory: { thread: 'thread-1', resource: 'resource-1' },
      }),
    );
  });

  it('lists durable awaiting inputs scoped by resource and thread', async () => {
    const storage = new InMemoryStore();
    await storage.init();
    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      throw new Error('Expected workflows store to be available for awaiting-input test setup');
    }

    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'thread-1-run',
      resourceId: 'resource-1',
      snapshot: createSuspendedSnapshot({
        runId: 'thread-1-run',
        toolCallId: 'thread-1-call',
        threadId: 'thread-1',
        suspendPayload: {
          type: 'approval',
          toolCallId: 'thread-1-call',
          toolName: 'writeFile',
          args: { path: 'THREAD_1.md' },
        },
      }),
      updatedAt: new Date(Date.now() + 1_000),
    });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'thread-2-run',
      resourceId: 'resource-1',
      snapshot: createSuspendedSnapshot({
        runId: 'thread-2-run',
        toolCallId: 'thread-2-call',
        threadId: 'thread-2',
        suspendPayload: {
          type: 'suspension',
          toolCallId: 'thread-2-call',
          toolName: 'confirmAction',
          args: { action: 'deploy' },
        },
      }),
      updatedAt: new Date(Date.now() + 2_000),
    });
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'other-resource-run',
      resourceId: 'other-resource',
      snapshot: createSuspendedSnapshot({
        runId: 'other-resource-run',
        toolCallId: 'other-resource-call',
        resourceId: 'other-resource',
        suspendPayload: {
          type: 'approval',
          toolCallId: 'other-resource-call',
          toolName: 'writeFile',
        },
      }),
    });

    const agent = new Agent({
      id: 'list-awaiting-inputs-agent',
      name: 'List Awaiting Inputs Agent',
      instructions: 'You write files.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });

    const harness = new Harness({
      id: 'list-awaiting-inputs-harness',
      resourceId: 'resource-1',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await harness.init();

    await expect(harness.listAwaitingInputs()).resolves.toMatchObject([
      {
        id: 'thread-2-call',
        kind: 'tool_suspension',
        durable: true,
        runId: 'thread-2-run',
        threadId: 'thread-2',
        resourceId: 'resource-1',
      },
      {
        id: 'thread-1-call',
        kind: 'tool_approval',
        durable: true,
        runId: 'thread-1-run',
        threadId: 'thread-1',
        resourceId: 'resource-1',
      },
    ]);

    await expect(harness.listAwaitingInputs({ threadId: 'thread-1' })).resolves.toMatchObject([
      {
        id: 'thread-1-call',
        kind: 'tool_approval',
        threadId: 'thread-1',
      },
    ]);

    await expect(harness.listAwaitingInputs({ resourceId: 'other-resource' })).resolves.toEqual([]);
  });

  it('reports questions and plans as live-session-only awaiting inputs', async () => {
    const agent = new Agent({
      id: 'live-only-agent',
      name: 'Live Only Agent',
      instructions: 'You ask questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });

    const harness = new Harness({
      id: 'live-only-harness',
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    (harness as any).emit({
      type: 'ask_question',
      questionId: 'q-1',
      question: 'Continue?',
      options: [{ label: 'Yes' }],
      selectionMode: 'single_select',
    });

    const question = await harness.getAwaitingInput({ id: 'q-1' });
    expect(question).toMatchObject({
      kind: 'question',
      durable: false,
      questionId: 'q-1',
    });
    await expect(harness.listAwaitingInputs()).resolves.toMatchObject([
      {
        id: 'q-1',
        kind: 'question',
        durable: false,
        questionId: 'q-1',
      },
    ]);

    const result = await harness.resumeAwaitingInput({ id: 'q-1', resumeData: 'Yes' });
    expect(result.status).toBe('live_session_only');
  });

  it('keeps live awaiting inputs scoped to the resource where they were created', async () => {
    const agent = new Agent({
      id: 'live-scope-agent',
      name: 'Live Scope Agent',
      instructions: 'You ask questions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });

    const harness = new Harness({
      id: 'live-scope-harness',
      resourceId: 'resource-1',
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    (harness as any).emit({
      type: 'ask_question',
      questionId: 'q-1',
      question: 'Continue?',
    });
    harness.setResourceId({ resourceId: 'resource-2' });

    await expect(harness.listAwaitingInputs()).resolves.toEqual([]);
    await expect(harness.getAwaitingInput({ id: 'q-1' })).resolves.toBeNull();
  });

  it('keeps auto-approved tool approvals inline by default', async () => {
    let streamDrained = false;
    const agent = new Agent({
      id: 'inline-auto-approval-agent',
      name: 'Inline Auto Approval Agent',
      instructions: 'You write files.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const harness = new Harness({
      id: 'inline-auto-approval-harness',
      initialState: { yolo: true } as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    const approvedMessage = {
      id: 'approved-message',
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Approved.' }],
      createdAt: new Date(),
    };
    const handleToolApprove = vi.fn(async () => {
      expect(streamDrained).toBe(false);
      return { message: approvedMessage };
    });
    (harness as any).handleToolApprove = handleToolApprove;

    const result = await (harness as any).processStream(
      {
        fullStream: createApprovalFullStream({
          afterApproval: () => {
            streamDrained = true;
          },
        }),
      },
      new RequestContext(),
    );

    expect(result.message).toBe(approvedMessage);
    expect(handleToolApprove).toHaveBeenCalledWith({
      toolCallId: 'approval-call',
      requestContext: expect.any(RequestContext),
    });
    expect(streamDrained).toBe(false);
  });

  it('defers auto-approved tool approvals until the stream drains when configured', async () => {
    let releaseStream: (() => void) | undefined;
    const afterApproval = vi.fn(
      () =>
        new Promise<void>(resolve => {
          releaseStream = resolve;
        }),
    );
    const agent = new Agent({
      id: 'deferred-auto-approval-agent',
      name: 'Deferred Auto Approval Agent',
      instructions: 'You write files.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const harness = new Harness({
      id: 'deferred-auto-approval-harness',
      initialState: { yolo: true } as any,
      deferredAutoApproval: true,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    const approvedMessage = {
      id: 'deferred-approved-message',
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Approved after drain.' }],
      createdAt: new Date(),
    };
    const handleToolApprove = vi.fn(async () => ({ message: approvedMessage }));
    const waitForAwaitingInputReady = vi.spyOn(harness, 'waitForAwaitingInputReady').mockResolvedValue(null);
    (harness as any).handleToolApprove = handleToolApprove;

    const resultPromise = (harness as any).processStream(
      { fullStream: createApprovalFullStream({ afterApproval }) },
      new RequestContext(),
    );

    await vi.waitFor(() => expect(afterApproval).toHaveBeenCalled());
    expect(handleToolApprove).not.toHaveBeenCalled();

    releaseStream?.();
    await expect(resultPromise).resolves.toMatchObject({ message: approvedMessage });
    expect(waitForAwaitingInputReady).toHaveBeenCalledWith({ id: 'approval-call' });
    expect(handleToolApprove).toHaveBeenCalledWith({
      toolCallId: 'approval-call',
      requestContext: expect.any(RequestContext),
    });
    expect(waitForAwaitingInputReady.mock.invocationCallOrder[0]!).toBeLessThan(
      handleToolApprove.mock.invocationCallOrder[0]!,
    );
  });

  it('replays all deferred auto-approved tool approvals sequentially', async () => {
    const agent = new Agent({
      id: 'deferred-auto-approval-queue-agent',
      name: 'Deferred Auto Approval Queue Agent',
      instructions: 'You write files.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const harness = new Harness({
      id: 'deferred-auto-approval-queue-harness',
      initialState: { yolo: true } as any,
      deferredAutoApproval: true,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    const approvedMessage = {
      id: 'deferred-approved-message',
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Approved after drain.' }],
      createdAt: new Date(),
    };
    const handleToolApprove = vi.fn(async () => ({ message: approvedMessage }));
    const waitForAwaitingInputReady = vi.spyOn(harness, 'waitForAwaitingInputReady').mockResolvedValue(null);
    (harness as any).handleToolApprove = handleToolApprove;

    await expect(
      (harness as any).processStream(
        { fullStream: createApprovalFullStream({ toolCallIds: ['approval-call-1', 'approval-call-2'] }) },
        new RequestContext(),
      ),
    ).resolves.toMatchObject({ message: approvedMessage });

    expect(waitForAwaitingInputReady).toHaveBeenNthCalledWith(1, { id: 'approval-call-1' });
    expect(waitForAwaitingInputReady).toHaveBeenNthCalledWith(2, { id: 'approval-call-2' });
    expect(handleToolApprove).toHaveBeenNthCalledWith(1, {
      toolCallId: 'approval-call-1',
      requestContext: expect.any(RequestContext),
    });
    expect(handleToolApprove).toHaveBeenNthCalledWith(2, {
      toolCallId: 'approval-call-2',
      requestContext: expect.any(RequestContext),
    });
    const [wait1, wait2] = waitForAwaitingInputReady.mock.invocationCallOrder;
    const [approve1, approve2] = handleToolApprove.mock.invocationCallOrder;
    expect(wait1!).toBeLessThan(approve1!);
    expect(approve1!).toBeLessThan(wait2!);
    expect(wait2!).toBeLessThan(approve2!);
  });
});
