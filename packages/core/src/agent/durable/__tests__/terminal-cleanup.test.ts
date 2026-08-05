/**
 * Tests for the snapshot-cleanup contract that keeps durable agent workflow
 * storage bounded (extends the fix for issue #19056).
 *
 * Contract: after a durable run reaches any non-suspended terminal status,
 * both the outer `AGENTIC_LOOP` snapshot row and the nested `AGENTIC_EXECUTION`
 * row are deleted. Suspended terminals keep the rows so a later `resume()` /
 * `recoverActiveRuns()` can find them. This mirrors the loop-stream cleanup
 * pattern in `packages/core/src/loop/workflows/stream.ts`.
 *
 * These are focused unit tests: we stub the durable workflow so the terminal
 * status is observable without spinning up the full agentic loop.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState, WorkflowRunStatus } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';

function makeSnapshot(runId: string, status: WorkflowRunStatus, agentId: string): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {
      input: {
        __workflowKind: 'durable-agent',
        runId,
        agentId,
        messageListState: { memoryInfo: { threadId: 't', resourceId: 'r' } },
      } as any,
    },
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    waitingPaths: {},
    timestamp: Date.now(),
  } as WorkflowRunState;
}

function makeMockModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'text-delta', textDelta: 'ok' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

function createDurableWithStore(agentId: string): {
  agent: DurableAgent;
  store: InMemoryStore;
} {
  const baseAgent = new Agent({
    id: agentId,
    name: agentId,
    instructions: 'x',
    model: makeMockModel(),
  });
  const store = new InMemoryStore();
  const agent = createDurableAgent({ agent: baseAgent });
  void new Mastra({
    agents: { [agentId]: agent as any },
    storage: store,
  });
  return { agent, store };
}

async function seedRunning(store: InMemoryStore, runId: string, agentId: string) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    resourceId: 'r',
    snapshot: makeSnapshot(runId, 'running', agentId),
  });
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_EXECUTION,
    runId,
    resourceId: 'r',
    snapshot: makeSnapshot(runId, 'running', agentId),
  });
}

/**
 * Stub the durable workflow so `restart()` returns a configurable terminal
 * status. `deleteWorkflowRunById` on the workflow is also spied so we can
 * assert the outer-loop row is deleted alongside the nested row (deleted via
 * the workflows storage domain).
 */
function stubWorkflow(agent: DurableAgent, terminalStatus: WorkflowRunStatus) {
  const deleteWorkflowRunById = vi.fn(async () => {});
  const fakeWorkflow = {
    createRun: vi.fn(async () => ({
      restart: vi.fn(async () => ({ status: terminalStatus })),
    })),
    deleteWorkflowRunById,
  };
  vi.spyOn(agent, 'getWorkflow').mockReturnValue(fakeWorkflow as any);
  return { deleteWorkflowRunById };
}

async function readSnapshot(store: InMemoryStore, workflowName: string, runId: string) {
  const workflows = (await store.getStore('workflows'))!;
  return workflows.getWorkflowRunById({ runId, workflowName });
}

describe('DurableAgent terminal snapshot cleanup', () => {
  let agent: DurableAgent;
  let store: InMemoryStore;

  beforeEach(() => {
    ({ agent, store } = createDurableWithStore('agent-A'));
  });

  describe('recoverActiveRuns', () => {
    it('deletes both AGENTIC_LOOP and AGENTIC_EXECUTION snapshot rows on success', async () => {
      await seedRunning(store, 'run-success', 'agent-A');
      const { deleteWorkflowRunById } = stubWorkflow(agent, 'success');

      const result = await agent.recoverActiveRuns();
      expect(result.succeeded).toBe(1);

      // Outer loop row deleted via workflow API…
      expect(deleteWorkflowRunById).toHaveBeenCalledWith('run-success');
      // …and the nested execution row is gone from storage.
      expect(await readSnapshot(store, DurableStepIds.AGENTIC_EXECUTION, 'run-success')).toBeNull();
    });

    it('deletes snapshot rows on failed terminal', async () => {
      await seedRunning(store, 'run-failed', 'agent-A');
      const { deleteWorkflowRunById } = stubWorkflow(agent, 'failed');

      await agent.recoverActiveRuns();

      expect(deleteWorkflowRunById).toHaveBeenCalledWith('run-failed');
      expect(await readSnapshot(store, DurableStepIds.AGENTIC_EXECUTION, 'run-failed')).toBeNull();
    });

    it('KEEPS snapshot rows on suspended terminal so a later resume can find them', async () => {
      await seedRunning(store, 'run-suspended', 'agent-A');
      const { deleteWorkflowRunById } = stubWorkflow(agent, 'suspended');

      await agent.recoverActiveRuns();

      expect(deleteWorkflowRunById).not.toHaveBeenCalled();
      const nested = await readSnapshot(store, DurableStepIds.AGENTIC_EXECUTION, 'run-suspended');
      expect(nested).not.toBeNull();
    });

    it('does not delete snapshot rows for runs whose restart throws', async () => {
      await seedRunning(store, 'run-boom', 'agent-A');
      const deleteWorkflowRunById = vi.fn(async () => {});
      const fakeWorkflow = {
        createRun: vi.fn(async () => ({
          restart: vi.fn(async () => {
            throw new Error('boom');
          }),
        })),
        deleteWorkflowRunById,
      };
      vi.spyOn(agent, 'getWorkflow').mockReturnValue(fakeWorkflow as any);

      const result = await agent.recoverActiveRuns();
      expect(result.failed).toBe(1);
      expect(deleteWorkflowRunById).not.toHaveBeenCalled();
      const nested = await readSnapshot(store, DurableStepIds.AGENTIC_EXECUTION, 'run-boom');
      expect(nested).not.toBeNull();
    });

    it('swallows snapshot delete failures without failing the recovered run', async () => {
      await seedRunning(store, 'run-delete-boom', 'agent-A');
      const fakeWorkflow = {
        createRun: vi.fn(async () => ({
          restart: vi.fn(async () => ({ status: 'success' })),
        })),
        // Simulate storage rejecting the delete — recovery should still count
        // as succeeded because the stale row is preferable to a broken exit.
        deleteWorkflowRunById: vi.fn(async () => {
          throw new Error('storage down');
        }),
      };
      vi.spyOn(agent, 'getWorkflow').mockReturnValue(fakeWorkflow as any);

      const result = await agent.recoverActiveRuns();
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
    });
  });
});
