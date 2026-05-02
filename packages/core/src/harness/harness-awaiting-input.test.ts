import { describe, expect, it, vi } from 'vitest';
import z from 'zod';

import { Agent } from '../agent';
import { Mastra } from '../mastra';
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
});
