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
}: {
  runId: string;
  toolCallId: string;
  suspendPayload: Record<string, unknown>;
}): WorkflowRunState {
  return {
    runId,
    status: 'suspended',
    value: {},
    context: {
      input: {
        state: {
          threadId: 'thread-1',
          resourceId: 'resource-1',
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
          requireToolApproval: {
            toolCallId: 'approval-call',
            toolName: 'writeFile',
            args: { path: 'README.md' },
          },
          __streamState: {
            toolCalls: [
              {
                payload: {
                  toolCallId: 'approval-call',
                  toolName: 'writeFile',
                  args: { path: 'README.md' },
                  resumeSchema: '{"type":"object"}',
                },
              },
            ],
          },
        },
      }),
    });
    const prototypeShadowSnapshot = createSuspendedSnapshot({
      runId: 'prototype-shadow-run',
      toolCallId: 'shadow-call',
      suspendPayload: {
        requireToolApproval: {
          toolCallId: 'shadow-call',
          toolName: 'wrongTool',
          args: { path: 'SHADOW.md' },
        },
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

    const result = await harness.resumeAwaitingInput({ id: 'q-1', resumeData: 'Yes' });
    expect(result.status).toBe('live_session_only');
  });

  it('prefers live tool approvals by id when an active run is still waiting', async () => {
    const storage = new InMemoryStore();
    await storage.init();
    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) {
      throw new Error('Expected workflows store to be available for live awaiting-input test setup');
    }
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: 'agentic-loop',
      runId: 'live-run',
      resourceId: 'resource-1',
      snapshot: createSuspendedSnapshot({
        runId: 'live-run',
        toolCallId: 'live-call',
        suspendPayload: {
          type: 'approval',
          toolCallId: 'live-call',
          toolName: 'writeFile',
          args: { path: 'README.md' },
        },
      }),
    });

    const agent = new Agent({
      id: 'live-approval-agent',
      name: 'Live Approval Agent',
      instructions: 'You approve tools.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const resumeStreamSpy = vi.spyOn(agent, 'resumeStream');

    const harness = new Harness({
      id: 'live-approval-harness',
      resourceId: 'resource-1',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: false } as any,
    });
    await harness.init();

    (harness as any).currentRunId = 'live-run';
    (harness as any).currentThreadId = 'thread-1';
    (harness as any).displayState.pendingApproval = {
      toolCallId: 'live-call',
      toolName: 'writeFile',
      args: { path: 'README.md' },
    };
    const pendingApprovalResolve = vi.fn();
    (harness as any).pendingApprovalResolve = pendingApprovalResolve;
    (harness as any).pendingApprovalToolName = 'writeFile';

    const result = await harness.resumeAwaitingInput({
      id: 'live-call',
      resumeData: 'decline',
    });

    expect(result.status).toBe('resumed');
    expect(result.awaitingInput).toMatchObject({
      kind: 'tool_approval',
      durable: false,
      runId: 'live-run',
      toolCallId: 'live-call',
      toolName: 'writeFile',
    });
    expect(pendingApprovalResolve).toHaveBeenCalledWith({ decision: 'decline', requestContext: undefined });
    expect((harness as any).pendingApprovalResolve).toBeNull();
    expect(resumeStreamSpy).not.toHaveBeenCalled();
  });
});
