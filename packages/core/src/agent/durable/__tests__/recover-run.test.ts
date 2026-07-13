/**
 * Tests for `DurableAgent.recover(runId)` — the single-run streamable
 * counterpart to `recoverActiveRuns()` (issue #19056 follow-up).
 *
 * These pin down the recover-single-run contract: rebuild the run's
 * non-serializable state from the persisted workflow snapshot, re-subscribe
 * to the pubsub topic, and re-drive the workflow in the background so
 * callers get a live stream + can attach via `observe()`.
 *
 * The durable workflow is stubbed so we can drive terminals deterministically
 * without spinning up the full agentic loop. Snapshot cleanup is validated
 * end-to-end against the in-memory workflow storage.
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
import { globalRunRegistry } from '../run-registry';

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
        requestContextEntries: { userId: 'u-1' },
        modelConfig: { provider: 'mock', modelId: 'mock-v1' },
        state: { threadId: 't', resourceId: 'r' },
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

function createDurableWithStore(agentId: string) {
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

async function seed(store: InMemoryStore, runId: string, status: WorkflowRunStatus, agentId: string) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    resourceId: 'r',
    snapshot: makeSnapshot(runId, status, agentId),
  });
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_EXECUTION,
    runId,
    resourceId: 'r',
    snapshot: makeSnapshot(runId, status, agentId),
  });
}

/**
 * Stub the durable workflow so `restart()` is observable without spinning up
 * the full agentic loop. Returns handles so tests can inspect the call and
 * drive terminals deterministically.
 */
function stubWorkflow(agent: DurableAgent, terminalStatus: WorkflowRunStatus) {
  const deleteWorkflowRunById = vi.fn(async () => {});
  const restart = vi.fn(async () => ({ status: terminalStatus }));
  const createRun = vi.fn(async ({ runId }: { runId: string }) => ({ restart, runId }));
  const fakeWorkflow = { createRun, restart, deleteWorkflowRunById };
  vi.spyOn(agent, 'getWorkflow').mockReturnValue(fakeWorkflow as any);
  return { deleteWorkflowRunById, createRun, restart };
}

async function readSnapshot(store: InMemoryStore, workflowName: string, runId: string) {
  const workflows = (await store.getStore('workflows'))!;
  return workflows.getWorkflowRunById({ runId, workflowName });
}

describe('DurableAgent.recover(runId)', () => {
  let agent: DurableAgent;
  let store: InMemoryStore;

  beforeEach(() => {
    ({ agent, store } = createDurableWithStore('agent-A'));
  });

  it('rehydrates the run registry with memory + messageList so terminal steps can flush', async () => {
    await seed(store, 'run-1', 'running', 'agent-A');
    stubWorkflow(agent, 'success');

    const { cleanup } = await agent.recover('run-1');

    const entry = globalRunRegistry.get('run-1');
    expect(entry).toBeDefined();
    expect(entry?.messageList).toBeDefined();
    expect(entry?.requestContext?.get?.('userId')).toBe('u-1');

    // The workflow settlement promise is parked on the registry entry so
    // recoverActiveRuns() can await it. Bulk callers rely on this contract.
    expect(entry?.workflowExecution).toBeInstanceOf(Promise);

    await entry?.workflowExecution;
    cleanup();
  });

  it('re-subscribes to the pubsub topic and returns a live fullStream', async () => {
    await seed(store, 'run-stream', 'running', 'agent-A');
    stubWorkflow(agent, 'success');

    const result = await agent.recover('run-stream');
    expect(result.runId).toBe('run-stream');
    expect(result.threadId).toBe('t');
    expect(result.resourceId).toBe('r');
    expect(result.fullStream).toBeDefined();
    expect(typeof result.abort).toBe('function');

    // Drain the stream without asserting on chunks — the stub does not
    // publish any events. Cleanup detaches the pubsub subscription so the
    // stream terminates immediately.
    await globalRunRegistry.get('run-stream')?.workflowExecution;
    result.cleanup();
  });

  it('deletes both AGENTIC_LOOP and AGENTIC_EXECUTION snapshot rows on success', async () => {
    await seed(store, 'run-ok', 'running', 'agent-A');
    const { deleteWorkflowRunById } = stubWorkflow(agent, 'success');

    const { cleanup } = await agent.recover('run-ok');
    await globalRunRegistry.get('run-ok')?.workflowExecution;
    cleanup();

    expect(deleteWorkflowRunById).toHaveBeenCalledWith('run-ok');
    expect(await readSnapshot(store, DurableStepIds.AGENTIC_EXECUTION, 'run-ok')).toBeNull();
  });

  it('keeps snapshot rows on suspended terminal so a later resume/recover can find them', async () => {
    await seed(store, 'run-suspend', 'running', 'agent-A');
    const { deleteWorkflowRunById } = stubWorkflow(agent, 'suspended');

    const { cleanup } = await agent.recover('run-suspend');
    await globalRunRegistry.get('run-suspend')?.workflowExecution;
    cleanup();

    expect(deleteWorkflowRunById).not.toHaveBeenCalled();
    expect(await readSnapshot(store, DurableStepIds.AGENTIC_EXECUTION, 'run-suspend')).not.toBeNull();
  });

  it('throws when no persisted snapshot exists for the runId', async () => {
    stubWorkflow(agent, 'success');

    await expect(agent.recover('missing-run')).rejects.toThrow(/no persisted workflow snapshot/i);
  });

  it('throws when the persisted snapshot is not a durable-agent workflow', async () => {
    const workflows = (await store.getStore('workflows'))!;
    await workflows.persistWorkflowSnapshot({
      workflowName: DurableStepIds.AGENTIC_LOOP,
      runId: 'foreign-run',
      resourceId: 'r',
      snapshot: {
        runId: 'foreign-run',
        status: 'running',
        value: {},
        context: { input: { __workflowKind: 'not-a-durable-agent' } as any },
        activePaths: [],
        activeStepsPath: {},
        suspendedPaths: {},
        resumeLabels: {},
        serializedStepGraph: [],
        waitingPaths: {},
        timestamp: Date.now(),
      } as WorkflowRunState,
    });
    stubWorkflow(agent, 'success');

    await expect(agent.recover('foreign-run')).rejects.toThrow(/does not contain a durable-agent workflow input/i);
  });

  it('rehydrates the registry with backgroundTaskManager + backgroundTasksConfig so bg-task-check / tool-call / llm-execution steps can still see background state after recovery', async () => {
    const agentId = 'bg-recover-agent';
    const baseAgent = new Agent({
      id: agentId,
      name: agentId,
      instructions: 'x',
      model: makeMockModel(),
      backgroundTasks: { tools: { research: true } },
    });
    const bgStore = new InMemoryStore();
    const bgAgent = createDurableAgent({ agent: baseAgent });
    const mastra = new Mastra({
      logger: false,
      agents: { [agentId]: bgAgent as any },
      storage: bgStore,
      backgroundTasks: { enabled: true },
    });

    await seed(bgStore, 'run-bg', 'running', agentId);
    stubWorkflow(bgAgent as any, 'success');

    const { cleanup } = await (bgAgent as any).recover('run-bg');

    const entry = globalRunRegistry.get('run-bg');
    expect(entry?.backgroundTaskManager).toBeDefined();
    expect(entry?.backgroundTaskManager).toBe(mastra.backgroundTaskManager);
    expect(entry?.backgroundTasksConfig).toEqual(baseAgent.getBackgroundTasksConfig());

    await entry?.workflowExecution;
    cleanup();
    await mastra.backgroundTaskManager?.shutdown();
  });

  it('reports workflow execution failure via the pubsub error stream', async () => {
    await seed(store, 'run-fail', 'running', 'agent-A');
    const deleteWorkflowRunById = vi.fn(async () => {});
    const restart = vi.fn(async () => {
      throw new Error('workflow blew up');
    });
    const createRun = vi.fn(async ({ runId }: { runId: string }) => ({ restart, runId }));
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({ createRun, restart, deleteWorkflowRunById } as any);

    let seenError: Error | undefined;
    const { cleanup } = await agent.recover('run-fail', {
      onError: ({ error }) => {
        seenError = error instanceof Error ? error : new Error(String(error));
      },
    });

    await globalRunRegistry.get('run-fail')?.workflowExecution?.catch(() => {});
    // Give the pubsub error propagation a tick to reach the onError callback.
    await new Promise(r => setTimeout(r, 10));
    cleanup();

    expect(seenError?.message).toBe('workflow blew up');
  });
});
