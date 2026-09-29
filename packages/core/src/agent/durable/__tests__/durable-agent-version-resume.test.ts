/**
 * Durable-agent version stability across suspend/resume (#22128 parity port).
 *
 * An agent selected by *status* (`{ status: 'published' }`) hot-switches to the
 * latest published version on every new run — that is the point of a status
 * selector. A durable run that already suspended must not hot-switch on a cold
 * resume: rehydration rebuilds tools/model/instructions from whatever version
 * the current agent instance resolves to, silently changing behavior underneath
 * a human approver.
 *
 * These tests pin the exact version resolved at run start into the persisted
 * workflow input (`agentVersionId`) and assert `DurableAgent.resume()`
 * re-resolves to that exact id on cold rehydration, honoring the explicit
 * call-site escape hatch and falling back gracefully when the pinned version is
 * gone. Mirrors main's `root-version-resume.test.ts` spec.
 *
 * The recover-path block asserts the same pin on `DurableAgent.recover()` —
 * the unattended crash-recovery path, which unlike resume has no call-site
 * version selector, so the pin must always win there.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { WorkflowRunState } from '../../../workflows/types';
import { Agent } from '../../agent';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

async function seedSuspendedRun(
  store: InMemoryStore,
  runId: string,
  agentId: string,
  memory: { threadId: string; resourceId: string },
  agentVersionId?: string,
  status: 'suspended' | 'running' = 'suspended',
) {
  const workflows = (await store.getStore('workflows'))!;
  await workflows.persistWorkflowSnapshot({
    workflowName: DurableStepIds.AGENTIC_LOOP,
    runId,
    resourceId: memory.resourceId,
    snapshot: {
      runId,
      status,
      value: {},
      context: {
        input: {
          __workflowKind: 'durable-agent',
          runId,
          agentId,
          ...(agentVersionId ? { agentVersionId } : {}),
          messageListState: { memoryInfo: memory },
          state: memory,
        },
      },
      activePaths: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      serializedStepGraph: [],
      waitingPaths: {},
      timestamp: Date.now(),
    } as unknown as WorkflowRunState,
  });
}

describe('durable agent version pinning across suspend/resume', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  function setup() {
    const store = new InMemoryStore();
    const baseAgent = new Agent({
      id: 'versioned-durable-agent',
      name: 'Versioned Durable Agent',
      instructions: 'You find users.',
      model: createTextModel('Resumed!') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const mastra = new Mastra({ agents: { versionedDurableAgent: durableAgent }, storage: store, logger: false });

    // Simulates the editor's `applyStoredOverrides`: fork, stamp the resolved
    // version id (via the DurableAgent rawConfig delegation), and mark the
    // fork the way `Mastra.resolveVersionedAgent` does.
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      if ('versionId' in selector && selector.versionId) {
        fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      }
      fork.__markStoredVersionApplied();
      return fork as typeof agent;
    });

    return { store, baseAgent, durableAgent, mastra, resolveSpy };
  }

  it('delegates rawConfig to the wrapped agent so editor version stamps are visible', () => {
    const { baseAgent, durableAgent } = setup();

    durableAgent.__setRawConfig({ resolvedVersionId: 'v1' });

    // The stamp must land on the wrapped agent — preparation and tracing read it from there.
    expect(baseAgent.toRawConfig()?.resolvedVersionId).toBe('v1');
    expect(durableAgent.toRawConfig()?.resolvedVersionId).toBe('v1');
  });

  it('persists the resolved version id into the durable workflow input', async () => {
    const { durableAgent } = setup();
    durableAgent.__setRawConfig({ resolvedVersionId: 'v1' });

    const preparation = await (durableAgent as DurableAgent).prepare(['hello'], { runId: 'version-pin-prep-run' });

    expect(preparation.workflowInput.agentVersionId).toBe('v1');
  });

  it('omits agentVersionId from the workflow input for purely code-defined agents', async () => {
    const { durableAgent } = setup();

    const preparation = await (durableAgent as DurableAgent).prepare(['hello'], { runId: 'no-version-prep-run' });

    expect(preparation.workflowInput.agentVersionId).toBeUndefined();
  });

  it('cold-resumes on the version the run suspended on, not the current one', async () => {
    const { store, durableAgent, resolveSpy } = setup();
    const runId = 'version-pin-cold-run';
    await seedSuspendedRun(store, runId, durableAgent.id, { threadId: 't-1', resourceId: 'r-1' }, 'v1');

    const result = await durableAgent.resume(runId, { approved: true });

    // The resume must re-resolve to the exact started version, not a status selector.
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith(expect.anything(), { versionId: 'v1' });
    // The pinned fork (not the original instance) rehydrated and owns the run.
    const fork = (await resolveSpy.mock.results[0]!.value) as DurableAgent;
    expect(fork.runRegistry.has(runId)).toBe(true);
    expect(durableAgent.runRegistry.has(runId)).toBe(false);
    expect(result.runId).toBe(runId);
    result.cleanup();
  });

  it('does not resolve a version when the run recorded none', async () => {
    const { store, durableAgent, resolveSpy } = setup();
    const runId = 'no-version-cold-run';
    await seedSuspendedRun(store, runId, durableAgent.id, { threadId: 't-1', resourceId: 'r-1' });

    const result = await durableAgent.resume(runId, { approved: true });

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    result.cleanup();
  });

  it('keeps an explicit call-site versionId as the operator escape hatch', async () => {
    const { store, durableAgent, resolveSpy } = setup();
    const runId = 'explicit-version-cold-run';
    await seedSuspendedRun(store, runId, durableAgent.id, { threadId: 't-1', resourceId: 'r-1' }, 'v1');

    const result = await durableAgent.resume(
      runId,
      { approved: true },
      { versions: { agents: { [durableAgent.id]: { versionId: 'v9' } } } },
    );

    // The explicitly chosen agent is left alone — no re-pin to v1.
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    result.cleanup();
  });

  it('skips the pin when this instance already resolved to the pinned version', async () => {
    const { store, durableAgent, resolveSpy } = setup();
    durableAgent.__setRawConfig({ resolvedVersionId: 'v1' });
    const runId = 'already-pinned-cold-run';
    await seedSuspendedRun(store, runId, durableAgent.id, { threadId: 't-1', resourceId: 'r-1' }, 'v1');

    const result = await durableAgent.resume(runId, { approved: true });

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    result.cleanup();
  });

  it('skips the pin on forks that already carry an applied stored version', async () => {
    const { store, durableAgent, resolveSpy } = setup();
    // e.g. the server explicitly resolved a version before calling resume.
    durableAgent.__markStoredVersionApplied();
    const runId = 'marked-fork-cold-run';
    await seedSuspendedRun(store, runId, durableAgent.id, { threadId: 't-1', resourceId: 'r-1' }, 'v1');

    const result = await durableAgent.resume(runId, { approved: true });

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    result.cleanup();
  });

  it('falls back to the current definition when the pinned version can no longer be resolved', async () => {
    const { store, durableAgent, resolveSpy } = setup();
    // The pinned version was deleted while the run sat suspended: the resume
    // must still complete rather than throwing at the approver.
    resolveSpy.mockRejectedValueOnce(new Error('version v1 not found'));
    const runId = 'deleted-version-cold-run';
    await seedSuspendedRun(store, runId, durableAgent.id, { threadId: 't-1', resourceId: 'r-1' }, 'v1');

    const result = await durableAgent.resume(runId, { approved: true });

    expect(resolveSpy).toHaveBeenCalledWith(expect.anything(), { versionId: 'v1' });
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    expect(result.runId).toBe(runId);
    result.cleanup();
  });
});

describe('durable agent version pinning across crash/recover', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  /** Stub the durable workflow so recover()'s background restart settles deterministically. */
  function stubWorkflow(agent: DurableAgent) {
    const restart = vi.fn(async () => ({ status: 'success' }));
    const createRun = vi.fn(async ({ runId }: { runId: string }) => ({ restart, runId }));
    vi.spyOn(agent, 'getWorkflow').mockReturnValue({
      createRun,
      restart,
      deleteWorkflowRunById: vi.fn(async () => {}),
    } as any);
    return { restart };
  }

  function setupRecover() {
    const store = new InMemoryStore();
    const baseAgent = new Agent({
      id: 'versioned-durable-agent',
      name: 'Versioned Durable Agent',
      instructions: 'You find users.',
      model: createTextModel('Recovered!') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    const mastra = new Mastra({ agents: { versionedDurableAgent: durableAgent }, storage: store, logger: false });
    stubWorkflow(durableAgent as DurableAgent);

    // Same shape as the resume harness's resolveVersionedAgent mock, but also
    // stubs the fork's workflow: a delegated recover() re-drives the run on
    // the fork, and the real durable workflow would hang the background
    // restart on a fabricated snapshot.
    const forks: DurableAgent[] = [];
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (agent, selector) => {
      const fork = agent.__fork();
      if ('versionId' in selector && selector.versionId) {
        fork.__setRawConfig({ resolvedVersionId: selector.versionId });
      }
      fork.__markStoredVersionApplied();
      stubWorkflow(fork as unknown as DurableAgent);
      forks.push(fork as unknown as DurableAgent);
      return fork as typeof agent;
    });

    return { store, baseAgent, durableAgent, mastra, resolveSpy, forks };
  }

  it('recovers on the version the run crashed on, not the current one', async () => {
    const { store, durableAgent, resolveSpy, forks } = setupRecover();
    const runId = 'version-pin-recover-run';
    await seedSuspendedRun(
      store,
      runId,
      durableAgent.id,
      { threadId: 't-rec-1', resourceId: 'r-rec-1' },
      'v1',
      'running',
    );

    const result = await durableAgent.recover(runId);

    // The unattended path must re-resolve to the exact crashed version.
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    expect(resolveSpy).toHaveBeenCalledWith(expect.anything(), { versionId: 'v1' });
    // The pinned fork (not the original instance) rehydrated and owns the run.
    const fork = forks[0]!;
    expect(fork.runRegistry.has(runId)).toBe(true);
    expect(durableAgent.runRegistry.has(runId)).toBe(false);
    expect(result.runId).toBe(runId);
    await fork.runRegistry.get(runId)?.workflowExecution;
    result.cleanup();
  });

  it('does not resolve a version when the crashed run recorded none', async () => {
    const { store, durableAgent, resolveSpy } = setupRecover();
    const runId = 'no-version-recover-run';
    await seedSuspendedRun(
      store,
      runId,
      durableAgent.id,
      { threadId: 't-rec-2', resourceId: 'r-rec-2' },
      undefined,
      'running',
    );

    const result = await durableAgent.recover(runId);

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    await durableAgent.runRegistry.get(runId)?.workflowExecution;
    result.cleanup();
  });

  it('falls back to the current definition when the pinned version can no longer be resolved', async () => {
    const { store, durableAgent, resolveSpy } = setupRecover();
    // The pinned version was deleted while the run sat crashed: recovery is
    // unattended, so it must proceed on the current definition, not fail.
    resolveSpy.mockRejectedValueOnce(new Error('version v1 not found'));
    const runId = 'deleted-version-recover-run';
    await seedSuspendedRun(
      store,
      runId,
      durableAgent.id,
      { threadId: 't-rec-3', resourceId: 'r-rec-3' },
      'v1',
      'running',
    );

    const result = await durableAgent.recover(runId);

    expect(resolveSpy).toHaveBeenCalledWith(expect.anything(), { versionId: 'v1' });
    expect(durableAgent.runRegistry.has(runId)).toBe(true);
    expect(result.runId).toBe(runId);
    await durableAgent.runRegistry.get(runId)?.workflowExecution;
    result.cleanup();
  });
});
