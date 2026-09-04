/**
 * Tests for `DurableAgent.listActiveRuns()` — the discovery API for orphaned
 * durable agent runs (issue #19056).
 *
 * These are storage-level unit tests: we seed snapshots directly into the
 * shared in-memory workflows store and assert the filtering logic. Running
 * the full durable agentic loop is unnecessary for exercising the discovery
 * contract and would drag in far more setup.
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
  input: {
    agentId?: string;
    threadId?: string;
    resourceId?: string;
  },
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
  // Registering the durable wrapper directly on Mastra invokes
  // __registerMastra, which wires storage and pubsub. This mirrors the
  // server bootstrap path used by `no-double-wrap-pubsub.test.ts`.
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

describe('DurableAgent.listActiveRuns', () => {
  let agent: DurableAgent;
  let store: InMemoryStore;

  beforeEach(() => {
    ({ agent, store } = createDurableWithStore('agent-A'));
  });

  it('returns an empty result when no runs are persisted', async () => {
    const result = await agent.listActiveRuns();
    expect(result).toEqual({ runs: [], total: 0 });
  });

  it('discovers running snapshots owned by this agent', async () => {
    await seed(
      store,
      makeSnapshot('run-1', 'running', {
        agentId: 'agent-A',
        threadId: 'thread-1',
        resourceId: 'resource-1',
      }),
      'resource-1',
    );

    const { runs, total } = await agent.listActiveRuns();
    expect(total).toBe(1);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe('run-1');
    expect(runs[0]!.status).toBe('running');
    expect(runs[0]!.threadId).toBe('thread-1');
    expect(runs[0]!.resourceId).toBe('resource-1');
    expect(runs[0]!.updatedAt).toBeInstanceOf(Date);
  });

  it('skips snapshots owned by other agents', async () => {
    await seed(store, makeSnapshot('run-A', 'running', { agentId: 'agent-A', threadId: 't', resourceId: 'r' }), 'r');
    await seed(store, makeSnapshot('run-B', 'running', { agentId: 'agent-B', threadId: 't', resourceId: 'r' }), 'r');

    const { runs, total } = await agent.listActiveRuns();
    expect(total).toBe(1);
    expect(runs[0]!.runId).toBe('run-A');
  });

  it('skips snapshots with no agentId (default-deny)', async () => {
    await seed(
      store,
      makeSnapshot('run-orphan', 'running', {
        agentId: undefined,
        threadId: 't',
        resourceId: 'r',
      }),
      'r',
    );

    const { runs, total } = await agent.listActiveRuns();
    expect(total).toBe(0);
    expect(runs).toEqual([]);
  });

  it('does not include suspended or terminal snapshots', async () => {
    await seed(
      store,
      makeSnapshot('run-running', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'r',
      }),
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

    const { runs, total } = await agent.listActiveRuns();
    expect(total).toBe(1);
    expect(runs[0]!.runId).toBe('run-running');
  });

  it('filters by threadId', async () => {
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

    const { runs, total } = await agent.listActiveRuns({ threadId: 'thread-2' });
    expect(total).toBe(1);
    expect(runs[0]!.runId).toBe('run-2');
    expect(runs[0]!.threadId).toBe('thread-2');
  });

  it('filters by resourceId', async () => {
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

    const { runs, total } = await agent.listActiveRuns({ resourceId: 'resource-2' });
    expect(total).toBe(1);
    expect(runs[0]!.runId).toBe('run-2');
    expect(runs[0]!.resourceId).toBe('resource-2');
  });

  it('pushes the resourceId filter down to the storage query (#21844)', async () => {
    await seed(
      store,
      makeSnapshot('run-1', 'running', {
        agentId: 'agent-A',
        threadId: 't',
        resourceId: 'resource-1',
      }),
      'resource-1',
    );

    const workflows = (await store.getStore('workflows'))!;
    const spy = vi.spyOn(workflows, 'listWorkflowRuns');

    await agent.listActiveRuns({ resourceId: 'resource-1' });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'running', resourceId: 'resource-1' }));
  });

  it('paginates when both perPage and page are provided', async () => {
    for (let i = 0; i < 5; i++) {
      await seed(
        store,
        makeSnapshot(`run-${i}`, 'running', {
          agentId: 'agent-A',
          threadId: 't',
          resourceId: 'r',
        }),
        'r',
      );
    }

    const first = await agent.listActiveRuns({ perPage: 2, page: 0 });
    const second = await agent.listActiveRuns({ perPage: 2, page: 1 });
    const third = await agent.listActiveRuns({ perPage: 2, page: 2 });

    expect(first.total).toBe(5);
    expect(first.runs).toHaveLength(2);
    expect(second.runs).toHaveLength(2);
    expect(third.runs).toHaveLength(1);
    const seen = new Set([
      ...first.runs.map(r => r.runId),
      ...second.runs.map(r => r.runId),
      ...third.runs.map(r => r.runId),
    ]);
    expect(seen.size).toBe(5);
  });

  it('fetches candidates from storage in bounded batches instead of one unbounded call', async () => {
    // 250 runs spanning three 100-row storage batches. Interleave runs owned
    // by another agent so app-level filtering is exercised across batches.
    for (let i = 0; i < 250; i++) {
      await seed(
        store,
        makeSnapshot(`run-${i}`, 'running', {
          agentId: i % 5 === 0 ? 'agent-B' : 'agent-A',
          threadId: 't',
          resourceId: 'r',
        }),
        'r',
      );
    }

    const workflows = (await store.getStore('workflows'))!;
    const spy = vi.spyOn(workflows, 'listWorkflowRuns');

    const { runs, total } = await agent.listActiveRuns();
    expect(total).toBe(200);
    expect(runs).toHaveLength(200);

    expect(spy).toHaveBeenCalledTimes(3);
    for (const [i, call] of spy.mock.calls.entries()) {
      expect(call[0]).toMatchObject({ status: 'running', perPage: 100, page: i });
    }
  });

  it('does not loop when the storage adapter ignores pagination', async () => {
    for (let i = 0; i < 150; i++) {
      await seed(
        store,
        makeSnapshot(`run-${i}`, 'running', { agentId: 'agent-A', threadId: 't', resourceId: 'r' }),
        'r',
      );
    }

    const workflows = (await store.getStore('workflows'))!;
    const original = workflows.listWorkflowRuns.bind(workflows);
    // Simulate an adapter that returns the full result set regardless of
    // perPage/page.
    const spy = vi
      .spyOn(workflows, 'listWorkflowRuns')
      .mockImplementation(args => original({ ...args, perPage: undefined, page: undefined }));

    const { runs, total } = await agent.listActiveRuns();
    expect(total).toBe(150);
    expect(runs).toHaveLength(150);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid perPage', async () => {
    await expect(agent.listActiveRuns({ perPage: 0 })).rejects.toThrow(/perPage to be a positive integer/);
    await expect(agent.listActiveRuns({ perPage: 1.5 })).rejects.toThrow(/perPage to be a positive integer/);
  });

  it('rejects invalid page', async () => {
    await expect(agent.listActiveRuns({ page: -1 })).rejects.toThrow(/page to be a non-negative integer/);
    await expect(agent.listActiveRuns({ page: 1.5 })).rejects.toThrow(/page to be a non-negative integer/);
  });

  it('throws a helpful error when no storage is registered', async () => {
    const baseAgent = new Agent({
      id: 'unbound',
      name: 'unbound',
      instructions: 'x',
      model: makeMockModel(),
    });
    const unboundAgent = createDurableAgent({ agent: baseAgent });
    await expect(unboundAgent.listActiveRuns()).rejects.toThrow(/requires storage/);
  });
});
