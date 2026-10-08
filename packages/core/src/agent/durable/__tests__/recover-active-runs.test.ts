/**
 * Tests for `DurableAgent.recoverActiveRuns()` — the boot-time / operator
 * hook that re-drives orphaned durable agent runs after a process restart
 * (issue #19056).
 *
 * These are unit tests: we stub the durable workflow so `restart()` is
 * observable without spinning up the full agentic loop. That behavior is
 * covered by the workflow engine's own restart tests; here we're pinning
 * down the discovery-and-dispatch contract of `recoverActiveRuns` itself.
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

function makeSnapshot(
  runId: string,
  status: WorkflowRunStatus,
  input: { agentId?: string; threadId?: string; resourceId?: string },
): WorkflowRunState {
  return {
    runId,
    status,
    value: {},
    context: {
      input: {
        __workflowKind: 'durable-agent',
        runId,
        agentId: input.agentId,
        messageListState: {
          memoryInfo:
            input.threadId || input.resourceId ? { threadId: input.threadId, resourceId: input.resourceId } : null,
        },
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

async function seed(store: InMemoryStore, snapshot: WorkflowRunState, resourceId?: string) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId: snapshot.runId,
    resourceId,
    snapshot,
  });
}

/**
 * Stub the durable workflow so `createRun({ runId }).restart()` is observable
 * without exercising the real agentic loop. Returns the recorded runIds and
 * a controller that lets tests make specific restarts fail.
 */
function stubWorkflow(agent: DurableAgent, behavior: { failFor?: Set<string> } = {}): { restartedRunIds: string[] } {
  const restartedRunIds: string[] = [];
  const failFor = behavior.failFor ?? new Set<string>();
  const fakeWorkflow = {
    createRun: vi.fn(async ({ runId }: { runId: string }) => ({
      restart: vi.fn(async () => {
        restartedRunIds.push(runId);
        if (failFor.has(runId)) {
          throw new Error(`boom-${runId}`);
        }
        return { status: 'success' };
      }),
    })),
  };
  vi.spyOn(agent, 'getWorkflow').mockReturnValue(fakeWorkflow as any);
  return { restartedRunIds };
}

describe('DurableAgent.recoverActiveRuns', () => {
  let agent: DurableAgent;
  let store: InMemoryStore;

  beforeEach(() => {
    ({ agent, store } = createDurableWithStore('agent-A'));
  });

  it('returns an empty result when no runs are active', async () => {
    stubWorkflow(agent);
    const result = await agent.recoverActiveRuns();
    expect(result).toEqual({ recovered: [], succeeded: 0, failed: 0 });
  });

  it('restarts every discovered running run for this agent', async () => {
    await seed(store, makeSnapshot('run-1', 'running', { agentId: 'agent-A', threadId: 't-1', resourceId: 'r' }), 'r');
    await seed(store, makeSnapshot('run-2', 'running', { agentId: 'agent-A', threadId: 't-2', resourceId: 'r' }), 'r');
    const { restartedRunIds } = stubWorkflow(agent);

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(2);
    expect(failed).toBe(0);
    expect(restartedRunIds.sort()).toEqual(['run-1', 'run-2']);
    expect(recovered.every(r => r.status === 'success')).toBe(true);
  });

  it('does not restart runs owned by other agents or in suspended / terminal states', async () => {
    await seed(store, makeSnapshot('run-mine', 'running', { agentId: 'agent-A', threadId: 't', resourceId: 'r' }), 'r');
    await seed(
      store,
      makeSnapshot('run-theirs', 'running', { agentId: 'agent-B', threadId: 't', resourceId: 'r' }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-suspended', 'suspended', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-done', 'success', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(1);
    expect(failed).toBe(0);
    expect(restartedRunIds).toEqual(['run-mine']);
    expect(recovered).toEqual([{ runId: 'run-mine', status: 'success' }]);
  });

  it('honors discovery filters (threadId)', async () => {
    await seed(
      store,
      makeSnapshot('run-1', 'running', {
        agentId: 'agent-A',
        threadId: 'thread-1',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-2', 'running', {
        agentId: 'agent-A',
        threadId: 'thread-2',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { succeeded } = await agent.recoverActiveRuns({ threadId: 'thread-2' });
    expect(succeeded).toBe(1);
    expect(restartedRunIds).toEqual(['run-2']);
  });

  it('honors discovery filters (resourceId)', async () => {
    await seed(
      store,
      makeSnapshot('run-1', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'resource-1',
      }),
      'resource-1',
    );
    await seed(
      store,
      makeSnapshot('run-2', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'resource-2',
      }),
      'resource-2',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { succeeded } = await agent.recoverActiveRuns({ resourceId: 'resource-2' });
    expect(succeeded).toBe(1);
    expect(restartedRunIds).toEqual(['run-2']);
  });

  it('captures per-run failures without aborting the rest', async () => {
    await seed(
      store,
      makeSnapshot('run-good-1', 'running', {
        agentId: 'agent-A',
        threadId: 't-good-1',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-bad', 'running', {
        agentId: 'agent-A',
        threadId: 't-bad',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('run-good-2', 'running', {
        agentId: 'agent-A',
        threadId: 't-good-2',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent, { failFor: new Set(['run-bad']) });

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();
    expect(succeeded).toBe(2);
    expect(failed).toBe(1);
    // All three runs were attempted (no short-circuit on the failure).
    expect(restartedRunIds.sort()).toEqual(['run-bad', 'run-good-1', 'run-good-2']);
    const bad = recovered.find(r => r.runId === 'run-bad');
    expect(bad?.status).toBe('failed');
    expect(bad?.error).toBeInstanceOf(Error);
    expect(bad?.error?.message).toBe('boom-run-bad');
  });

  it('skips a run another execution still owns, with when to check again, and leaves out runs no longer running', async () => {
    for (const id of ['run-live-elsewhere', 'run-orphan', 'run-suspends']) {
      await seed(store, makeSnapshot(id, 'running', { agentId: 'agent-A', threadId: `t-${id}`, resourceId: 'r' }), 'r');
    }
    await seed(
      store,
      makeSnapshot('run-suspended', 'suspended', { agentId: 'agent-A', threadId: 't-suspended', resourceId: 'r' }),
      'r',
    );
    const workflows = (await store.getStore('workflows'))!;
    await workflows.claimRunOwnership({ runId: 'run-live-elsewhere', ownerId: 'other-instance', leaseMs: 30_000 });
    // run-suspends suspends after discovery listed it, before its recovery.
    const listActiveRuns = agent.listActiveRuns.bind(agent);
    vi.spyOn(agent, 'listActiveRuns').mockImplementationOnce(async options => {
      const result = await listActiveRuns(options);
      await seed(
        store,
        makeSnapshot('run-suspends', 'suspended', { agentId: 'agent-A', threadId: 't-run-suspends', resourceId: 'r' }),
        'r',
      );
      return result;
    });
    const { restartedRunIds } = stubWorkflow(agent);
    const before = Date.now();

    const { recovered, succeeded, failed } = await agent.recoverActiveRuns();

    expect(restartedRunIds).toEqual(['run-orphan']);
    expect({ succeeded, failed }).toEqual({ succeeded: 1, failed: 0 });
    expect(recovered.map(r => r.runId).sort()).toEqual(['run-live-elsewhere', 'run-orphan']);
    const live = recovered.find(r => r.runId === 'run-live-elsewhere')!;
    expect(live).toMatchObject({ status: 'skipped', reason: 'run-active' });
    expect(live.retryAt).toBeGreaterThanOrEqual(before + 1_000);
    expect(live.retryAt).toBeLessThanOrEqual(Date.now() + 30_000);
    expect((await workflows.getRunOwnership({ runId: 'run-live-elsewhere' }))?.ownerId).toBe('other-instance');

    // An explicit runId, as the boot re-check passes, is held to the same rule.
    await seed(
      store,
      makeSnapshot('run-finished', 'success', { agentId: 'agent-A', threadId: 't-finished', resourceId: 'r' }),
      'r',
    );
    for (const id of ['run-suspended', 'run-finished', 'run-missing']) {
      await expect(agent.recoverActiveRuns({ runId: id })).resolves.toEqual({ recovered: [], succeeded: 0, failed: 0 });
    }
    expect(restartedRunIds).toEqual(['run-orphan']);
  });

  it('restarts a specific run when `runId` is given and skips discovery', async () => {
    // Both snapshots are seeded so `recover()` can load the input for either
    // run, but the explicit runId option must prevent `discovered` from being
    // picked up.
    await seed(
      store,
      makeSnapshot('discovered', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    await seed(
      store,
      makeSnapshot('explicit-run', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );
    const { restartedRunIds } = stubWorkflow(agent);

    const { succeeded } = await agent.recoverActiveRuns({ runId: 'explicit-run' });
    expect(succeeded).toBe(1);
    // `discovered` must not have been picked up when `runId` is set.
    expect(restartedRunIds).toEqual(['explicit-run']);
  });
});
