/**
 * Evented agent runs whose pubsub redelivers unacked messages, on a store with run fencing and step guards (COR-1609).
 * The pubsub decides which worker holds a delivery, and the claim's generation decides which delivery commits, so the
 * run owners row is claimed and released but never renewed, and nothing reads its expiry.
 *
 * InMemoryStore has run fencing but no step guards. Tests that go through the setup decision report guards on its
 * workflows store; the rest pass `pubsubOwned` to the claim directly, as the engine does once the decision holds.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { Mastra } from '../../mastra';
import { sharedBroker } from '../../mastra/test-utils/shared-broker';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { RUN_FENCE_CONFLICT_ERROR_ID } from '../../storage/run-fencing';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows/evented';
import { EventedExecutionEngine } from '../../workflows/evented/execution-engine';
import { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { DurableStepIds } from './constants';
import { createEventedAgent } from './create-evented-agent';
import {
  participateInDurableExecution,
  settleEventedDurableExecution,
  stopDurableExecutionParticipants,
} from './evented-execution';
import { EventedAgentExecutionEngine } from './execution-engine';
import {
  __resetExecutionFencesForTests,
  EXECUTION_CONFLICT_ERROR_ID,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_LEASE_TTL_MS,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  getExecutionClaim,
  getExecutionOwnershipGuard,
  MASTRA_DURABLE_EXECUTIONS_KEY,
  OWNERSHIP_READ_TIMEOUT_MS,
  pubsubOwnsEventedRuns,
  RUN_ACTIVE_ERROR_ID,
  withExecutionFence,
} from './execution-fence';
import { abandonDurableAgentExecutions, deleteRunRegistryEntry, setRunRegistryEntry } from './run-registry';

const instances: Mastra[] = [];
afterEach(async () => {
  for (const mastra of instances.splice(0)) {
    await stopDurableExecutionParticipants(mastra);
    await mastra.pubsub.close();
  }
  __resetExecutionFencesForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const threadKey = 'resource\u0000thread';

/** A worker on a broker that redelivers unacked messages, and the API's pubsub-owned claim on `run`. */
async function createPubsubOwnedExecution(options: { thread?: boolean } = {}) {
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const pubsub = sharedBroker({ leases: true, redeliversUnacked: true }).connect();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  instances.push(mastra);
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
    pubsubOwned: true,
  });
  onTestFinished(() => coordinator.detach());
  const claim = options.thread
    ? { ...coordinator.claim, threadId: 'thread', resourceId: 'resource' }
    : coordinator.claim;
  if (options.thread) {
    await agentThreadStreamRuntime.claimDurableThreadLease(
      pubsub,
      'run',
      'thread',
      'resource',
      coordinator.generation,
      coordinator.executionId,
    );
  }
  const event: Event = {
    id: 'delivery',
    type: 'workflow.step.run',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: DurableStepIds.AGENTIC_LOOP,
      runId: 'run',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: claim } },
    },
  };
  return { storage, workflowsStore, pubsub, mastra, coordinator, event };
}

/** A durable step's execute, run the way the durable loop runs it inside a delivery. */
function runStep(mastra: Mastra, event: Event, execute: (signal: AbortSignal) => Promise<unknown>) {
  const step = withExecutionFence({
    execute: async (params: object) => execute(getExecutionOwnershipGuard(params)!.composeSignal(undefined)),
  });
  return participateInDurableExecution(mastra, event, () =>
    step.execute({
      mastra,
      requestContext: new RequestContext(Object.entries(event.data.requestContext)),
      getInitData: () => ({ runId: 'run', agentId: 'agent' }),
    }),
  );
}

it.each([
  { setup: 'in-process pubsub', redelivers: undefined, guards: true, fencing: true, owned: false },
  { setup: 'broker without redelivery', redelivers: false, guards: true, fencing: true, owned: false },
  { setup: 'store without step guards', redelivers: true, guards: false, fencing: true, owned: false },
  { setup: 'store without run fencing', redelivers: true, guards: true, fencing: false, owned: false },
  { setup: 'durable broker and guarded fencing store', redelivers: true, guards: true, fencing: true, owned: true },
])('leaves run ownership to the pubsub only on the supported setup ($setup)', async args => {
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  vi.spyOn(workflowsStore, 'supportsWorkflowStepGuards').mockReturnValue(args.guards);
  vi.spyOn(workflowsStore, 'supportsRunFencing').mockReturnValue(args.fencing);
  const pubsub: PubSub =
    args.redelivers === undefined
      ? new EventEmitterPubSub()
      : sharedBroker({ leases: true, redeliversUnacked: args.redelivers }).connect();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  instances.push(mastra);
  const engine = new EventedAgentExecutionEngine('agent', mastra);
  const logger = mastra.getLogger();

  expect(await engine.pubsubOwnsRuns(logger)).toBe(args.owned);
  const fence = await engine.claimExecution('run', 'acquire', pubsub, logger);
  onTestFinished(() => fence.detach());
  expect(fence.claim.pubsubOwned).toBe(args.owned ? true : undefined);
});

// A worker handling a delivery minutes after the run was claimed must not fail it as unverified because a lease
// lapsed: nothing renews the claim, and nothing reads its expiry.
it('handles every delivery of a pubsub-owned run long after its claim would have lapsed, renewing nothing', async () => {
  vi.useFakeTimers();
  const { workflowsStore, mastra, coordinator, event } = await createPubsubOwnedExecution();
  // The API process that claimed the run is gone, so nothing in it can keep the claim live either.
  coordinator.detach();
  const renewals = vi.spyOn(workflowsStore, 'renewRunOwnership');

  expect(await participateInDurableExecution(mastra, event, async () => 'first')).toBe('first');
  // A non-terminal delivery leaves no participant or run scope behind.
  expect(mastra.__getRunScope('run')).toBeUndefined();
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    live: false,
  });

  // A model call that outlasts several TTLs keeps running.
  const second = await runStep(mastra, event, async signal => {
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);
    return signal.aborted ? 'aborted' : 'second';
  });
  expect(second).toBe('second');
  expect(await participateInDurableExecution(mastra, { ...event, id: 'third' }, async () => 'third')).toBe('third');

  expect(renewals).not.toHaveBeenCalled();
  expect(mastra.__getRunScope('run')).toBeUndefined();
});

it('drops a delivery from a superseded generation and refuses its writes', async () => {
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createPubsubOwnedExecution();
  await participateInDurableExecution(mastra, event, async () => {});

  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'takeover',
    pubsubOwned: true,
  });
  onTestFinished(() => successor.detach());
  expect(successor.generation).toBeGreaterThan(coordinator.generation!);

  const handler = vi.fn(async () => {});
  await expect(participateInDurableExecution(mastra, { ...event, id: 'late' }, handler)).rejects.toMatchObject({
    id: EXECUTION_SUPERSEDED_ERROR_ID,
  });
  expect(handler).not.toHaveBeenCalled();
  // The processor acks it, so the broker does not redeliver it.
  expect(await new WorkflowEventProcessor({ mastra }).handle({ ...event, id: 'redelivered' })).toEqual({ ok: true });
  await expect(
    workflowsStore.deleteWorkflowRunById({
      runId: 'run',
      workflowName: DurableStepIds.AGENTIC_LOOP,
      fence: { runId: 'run', generation: coordinator.generation!, ownerId: coordinator.executionId },
    }),
  ).rejects.toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
});

// A worker still running a model or tool call for a superseded claim stops at its next ownership poll.
it('aborts an in-flight step of a pubsub-owned run once another execution takes the run over', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, event } = await createPubsubOwnedExecution();
  const entered = Promise.withResolvers<void>();
  const delivery = runStep(mastra, event, signal => {
    entered.resolve();
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  });
  const outcome = delivery.catch(error => error);
  await entered.promise;
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);

  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'takeover',
    pubsubOwned: true,
  });
  onTestFinished(() => successor.detach());
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(await outcome).toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
});

// The step's model or tool call already ran: a storage blip at the end-of-step check must not throw that work away.
it('retries a failed ownership read at the end of a step instead of failing the delivery', async () => {
  vi.useFakeTimers();
  const { workflowsStore, mastra, event } = await createPubsubOwnedExecution();
  const read = workflowsStore.getRunOwnership.bind(workflowsStore);
  let failNext = 0;
  vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementation(args =>
    failNext-- > 0 ? Promise.reject(new Error('connection reset (test)')) : read(args),
  );
  const delivery = runStep(mastra, event, async () => {
    failNext = 2;
    return 'done';
  });
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await delivery).toBe('done');
});

// A periodic read that fails while the step finishes is not the end-of-step check's answer.
it('reads ownership again at the end of a step when a periodic read in flight fails', async () => {
  vi.useFakeTimers();
  const { workflowsStore, mastra, event } = await createPubsubOwnedExecution();
  const read = workflowsStore.getRunOwnership.bind(workflowsStore);
  const stalled = Promise.withResolvers<never>();
  let stall = false;
  vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementation(args => {
    if (!stall) return read(args);
    stall = false;
    return stalled.promise;
  });
  const delivery = runStep(mastra, event, async () => {
    stall = true;
    // The periodic read starts and hangs; the step finishes meanwhile.
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
    setTimeout(() => stalled.reject(new Error('connection reset (test)')), 100);
    return 'done';
  });
  await vi.advanceTimersByTimeAsync(1_000);
  expect(await delivery).toBe('done');
});

// A read that never answers is a storage failure: the delivery fails and the broker redelivers it.
it('fails a delivery as unverified when the end-of-step ownership read never answers', async () => {
  vi.useFakeTimers();
  const { workflowsStore, mastra, event } = await createPubsubOwnedExecution();
  const read = workflowsStore.getRunOwnership.bind(workflowsStore);
  let hang = false;
  vi.spyOn(workflowsStore, 'getRunOwnership').mockImplementation(args => (hang ? new Promise(() => {}) : read(args)));
  const outcome = runStep(mastra, event, async () => {
    hang = true;
    return 'done';
  }).catch(error => error);
  await vi.advanceTimersByTimeAsync(OWNERSHIP_READ_TIMEOUT_MS * 3 + 1_000);
  expect(await outcome).toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
});

it("acks a root terminal redelivered after settlement without touching its successor's claim", async () => {
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createPubsubOwnedExecution();
  const terminal: Event = { ...event, id: 'terminal', type: 'workflow.end' };
  await participateInDurableExecution(mastra, terminal, () => settleEventedDurableExecution(mastra, terminal));
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    leaseExpiresAt: null,
  });

  // A settled run takes a new claim at once.
  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
    pubsubOwned: true,
  });
  onTestFinished(() => successor.detach());
  const claimed = await workflowsStore.getRunOwnership({ runId: 'run' });
  const releases = vi.spyOn(workflowsStore, 'releaseRunOwnership');
  const deletes = vi.spyOn(workflowsStore, 'deleteWorkflowRunById');

  expect(await new WorkflowEventProcessor({ mastra }).handle(JSON.parse(JSON.stringify(terminal)))).toEqual({
    ok: true,
  });
  expect(releases).not.toHaveBeenCalled();
  expect(deletes).not.toHaveBeenCalled();
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toEqual(claimed);
  expect(claimed).toMatchObject({ ownerId: successor.executionId, generation: successor.generation });
  expect(claimed?.leaseExpiresAt).not.toBeNull();
});

// Nothing renews the claim, so the conflict is decided by the claim not being released, however old it is.
it('refuses a second stream of an unsettled pubsub-owned run after its claim would have lapsed', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, coordinator } = await createPubsubOwnedExecution();
  // The second stream comes from another process.
  __resetExecutionFencesForTests();
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);
  const claim = () =>
    ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode: 'acquire',
      pubsubOwned: true,
    });
  const refused = claim().catch(error => error);
  await vi.advanceTimersByTimeAsync(6_000);
  expect(await refused).toMatchObject({ id: EXECUTION_CONFLICT_ERROR_ID });

  await workflowsStore.releaseRunOwnership({
    runId: 'run',
    generation: coordinator.generation!,
    ownerId: coordinator.executionId,
  });
  const next = await claim();
  onTestFinished(() => next.detach());
  expect(next.generation).toBeGreaterThan(coordinator.generation!);
});

// A claim nothing renews never lapses, so a recovery refuses it with no time to retry at, and nothing schedules a
// re-check that would refuse again forever. Only a takeover replaces it.
it('refuses to recover an unreleased pubsub-owned claim long after it was made, without a retry time', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, coordinator } = await createPubsubOwnedExecution();
  coordinator.detach();
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);
  const claim = (mode: 'recover' | 'takeover') =>
    ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode,
      pubsubOwned: true,
    });

  const refused = await claim('recover').catch(error => error);
  expect(refused).toMatchObject({ id: RUN_ACTIVE_ERROR_ID, details: { holder: coordinator.executionId } });
  expect(refused.details).not.toHaveProperty('retryAt');

  const recovered = await claim('takeover');
  onTestFinished(() => recovered.detach());
  expect(recovered.generation).toBeGreaterThan(coordinator.generation!);
});

// Nothing renews the claim of the process that started a run, so it reads the run's record to learn it lost the run.
it('tells the process that started a pubsub-owned run that another execution took it over', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { workflowsStore, pubsub, coordinator } = await createPubsubOwnedExecution();
  const renewals = vi.spyOn(workflowsStore, 'renewRunOwnership');
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS * 3);
  expect(coordinator.isLost()).toBe(false);

  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'takeover',
    pubsubOwned: true,
  });
  onTestFinished(() => successor.detach());
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(coordinator.isLost()).toBe(true);
  expect(await coordinator.callerLossError()).toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  expect(renewals).not.toHaveBeenCalled();
});

// A worker releases the claim when it settles the run, just before the terminal event reaches this process. A
// release nothing settles, such as an abandoned terminal, is reported one interval later.
it('gives a released pubsub-owned claim one interval to settle before reporting the loss', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { workflowsStore, coordinator } = await createPubsubOwnedExecution();
  await workflowsStore.releaseRunOwnership({
    runId: 'run',
    generation: coordinator.generation!,
    ownerId: coordinator.executionId,
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(coordinator.isLost()).toBe(false);
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(coordinator.isLost()).toBe(true);
  expect(await coordinator.callerLossError()).toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
});

it('stops watching a pubsub-owned claim once the process that started the run settles it', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { workflowsStore, coordinator } = await createPubsubOwnedExecution();
  expect(await coordinator.settle(async () => {})).toBe('owned');
  const reads = vi.spyOn(workflowsStore, 'getRunOwnership');
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS * 3);
  expect(reads).not.toHaveBeenCalled();
  expect(coordinator.isLost()).toBe(false);
});

it('keeps the thread busy while a delivery runs and takes back a lease that lapsed between deliveries', async () => {
  vi.useFakeTimers();
  const { pubsub, mastra, event } = await createPubsubOwnedExecution({ thread: true });
  const owner = await pubsub.getLeaseOwner(threadKey);
  expect(owner).toBeDefined();

  const during = await participateInDurableExecution(mastra, event, async () => {
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 3);
    return pubsub.getLeaseOwner(threadKey);
  });
  expect(during).toBe(owner);

  // Between deliveries nothing renews it.
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);
  expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined();
  expect(
    await participateInDurableExecution(mastra, { ...event, id: 'next' }, () => pubsub.getLeaseOwner(threadKey)),
  ).toBe(owner);
});

// The terminal delivery released the claim and the thread lease while this delivery was taking the lapsed lease back.
it('gives the thread lease back when the claim was released while a delivery took it back', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createPubsubOwnedExecution({ thread: true });
  await pubsub.releaseLease(threadKey, (await pubsub.getLeaseOwner(threadKey))!);
  const reclaim = agentThreadStreamRuntime.reclaimDurableThreadLease.bind(agentThreadStreamRuntime);
  vi.spyOn(agentThreadStreamRuntime, 'reclaimDurableThreadLease').mockImplementation(async (...args) => {
    await workflowsStore.releaseRunOwnership({
      runId: 'run',
      generation: coordinator.generation!,
      ownerId: coordinator.executionId,
    });
    return reclaim(...args);
  });
  expect(await participateInDurableExecution(mastra, event, () => pubsub.getLeaseOwner(threadKey))).toBeUndefined();
});

// A renewal can miss, for example after the event loop stalled past the TTL. While the claim holds, take it back.
it('takes the thread lease back during a delivery when a renewal finds it lapsed', async () => {
  vi.useFakeTimers();
  const { pubsub, mastra, event } = await createPubsubOwnedExecution({ thread: true });
  const owner = (await pubsub.getLeaseOwner(threadKey))!;
  const during = await participateInDurableExecution(mastra, event, async () => {
    await pubsub.releaseLease(threadKey, owner);
    await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS + 1);
    return pubsub.getLeaseOwner(threadKey);
  });
  expect(during).toBe(owner);
});

it('never takes a thread lease another owner holds, and still handles the delivery', async () => {
  vi.useFakeTimers();
  const { pubsub, mastra, event } = await createPubsubOwnedExecution({ thread: true });
  const owner = (await pubsub.getLeaseOwner(threadKey))!;
  await pubsub.transferLease(threadKey, owner, 'another-run', EXECUTION_LEASE_TTL_MS * 10);

  expect(
    await participateInDurableExecution(mastra, event, async () => {
      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);
      return 'delivered';
    }),
  ).toBe('delivered');
  expect(await pubsub.getLeaseOwner(threadKey)).toBe('another-run');
});

// A run started on the API process, whose deliveries no worker picked up yet, keeps its claim. Boot recovery must
// leave it to the broker, as it leaves evented workflow runs, instead of restarting it beside a redelivery.
it('leaves pubsub-owned evented agent runs to the broker on automatic recovery, while recover() takes them over', async () => {
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  vi.spyOn(workflowsStore, 'supportsWorkflowStepGuards').mockReturnValue(true);
  const pubsub = sharedBroker({ leases: true, redeliversUnacked: true }).connect();
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
  const agent = createEventedAgent({
    agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Answer.', model }),
    pubsub,
  });
  // No workers: the run's first delivery waits at the broker.
  const mastra = new Mastra({ agents: { agent }, storage, pubsub, workers: false, logger: false });
  instances.push(mastra);
  onTestFinished(() => mastra.shutdown());

  const { runId, cleanup } = await agent.stream('Answer.');
  onTestFinished(() => cleanup());
  await vi.waitFor(
    async () =>
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: DurableStepIds.AGENTIC_LOOP, runId })).toBe(
        'running',
      ),
    { timeout: 5_000 },
  );
  const claimed = (await workflowsStore.getRunOwnership({ runId }))!;

  expect(await agent.recoverActiveRuns()).toEqual({ recovered: [], succeeded: 0, failed: 0 });
  expect(await mastra.recoverAllDurableAgents()).toMatchObject({ recovered: 0, skipped: 0, failed: 0 });
  expect(await workflowsStore.getRunOwnership({ runId })).toEqual(claimed);

  // Recover as another process would: this one still refuses a run it executes.
  __resetExecutionFencesForTests();
  // A recovery by run ID refuses the unreleased claim, with no retry time for a re-check to loop on.
  expect(await agent.recoverActiveRuns({ runId })).toEqual({
    recovered: [{ runId, status: 'skipped', reason: 'run-active' }],
    succeeded: 0,
    failed: 0,
  });
  expect(await workflowsStore.getRunOwnership({ runId })).toEqual(claimed);

  // The claim is still unexpired, which would refuse a lease-backed recovery too. recover() takes the run over.
  expect(claimed.live).toBe(true);
  const recovered = await agent.recover(runId);
  onTestFinished(() => recovered.cleanup());
  expect((await workflowsStore.getRunOwnership({ runId }))?.generation).toBeGreaterThan(claimed.generation);
});

/** An EventedAgent on a redelivering broker whose store reports step guards, so its runs are pubsub-owned. */
function createPubsubOwnedAgent(options: { workers?: boolean; storage?: InMemoryStore; pubsub?: PubSub } = {}) {
  const storage = options.storage ?? new InMemoryStore();
  const pubsub = options.pubsub ?? sharedBroker({ leases: true, redeliversUnacked: true }).connect();
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
  const agent = createEventedAgent({
    agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Answer.', model }),
    pubsub,
  });
  const mastra = new Mastra({ agents: { agent }, storage, pubsub, workers: options.workers ?? false, logger: false });
  instances.push(mastra);
  onTestFinished(() => mastra.shutdown());
  return { storage, pubsub, agent, mastra };
}

async function guardedWorkflowsStore(storage: InMemoryStore) {
  const workflowsStore = (await storage.getStore('workflows'))!;
  vi.spyOn(workflowsStore, 'supportsWorkflowStepGuards').mockReturnValue(true);
  return workflowsStore;
}

// A second approval of the same tool call, from another server, while the first approval's resumed run is still
// executing. It must be refused; taking the run over would abort the live model call and run it again.
it('refuses a second resume of a pubsub-owned run that is executing, and the first resume finishes', async () => {
  const storage = new InMemoryStore();
  const workflowsStore = await guardedWorkflowsStore(storage);
  const broker = sharedBroker({ leases: true, redeliversUnacked: true });
  const resumedCall = Promise.withResolvers<void>();
  const resumedEntered = Promise.withResolvers<void>();
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      const call = ++calls;
      if (call === 2) {
        resumedEntered.resolve();
        await resumedCall.promise;
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(call === 1
            ? [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'lookup', input: '{}' }]
            : [
                { type: 'text-start' as const, id: 'text' },
                { type: 'text-delta' as const, id: 'text', delta: 'resumed answer' },
                { type: 'text-end' as const, id: 'text' },
              ]),
          {
            type: 'finish',
            finishReason: call === 1 ? 'tool-calls' : 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
      };
    },
  });
  const execute = vi.fn(async () => ({ found: true }));
  const build = (pubsub: PubSub) =>
    createEventedAgent({
      agent: new Agent({
        id: 'agent',
        name: 'agent',
        instructions: 'Answer.',
        model,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look something up',
            inputSchema: z.object({}),
            requireApproval: true,
            execute,
          }),
        },
      }),
      pubsub,
    });
  const serverA = broker.connect();
  const serverB = broker.connect();
  const agentA = build(serverA);
  const agentB = build(serverB);
  const mastraA = new Mastra({ agents: { agent: agentA }, storage, pubsub: serverA, logger: false });
  const mastraB = new Mastra({ agents: { agent: agentB }, storage, pubsub: serverB, workers: false, logger: false });
  instances.push(mastraA, mastraB);
  onTestFinished(async () => {
    resumedCall.resolve();
    await mastraB.shutdown();
    await mastraA.shutdown();
  });

  const started = await agentA.stream('Look it up', { requireToolApproval: true });
  const { runId } = started;
  void drain(started.fullStream).catch(() => {});
  await vi.waitFor(
    async () =>
      expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: DurableStepIds.AGENTIC_LOOP, runId })).toBe(
        'suspended',
      ),
    { timeout: 5_000 },
  );
  await vi.waitFor(async () => expect((await workflowsStore.getRunOwnership({ runId }))?.leaseExpiresAt).toBeNull(), {
    timeout: 5_000,
  });

  const resumed = await agentA.resume(runId, { approved: true });
  const resumedChunks = drain(resumed.fullStream);
  await resumedEntered.promise;
  const claimed = await workflowsStore.getRunOwnership({ runId });

  // Server B never saw the run: it only finds it running in storage.
  __resetExecutionFencesForTests();
  await expect(agentB.resume(runId, { approved: true })).rejects.toMatchObject({ id: 'AGENT_RESUME_ALREADY_CLAIMED' });
  expect(await workflowsStore.getRunOwnership({ runId })).toEqual(claimed);

  resumedCall.resolve();
  const chunks = await resumedChunks;
  expect(chunks.map(chunk => chunk.type)).toContain('finish');
  expect(JSON.stringify(chunks)).toContain('resumed answer');
  expect(execute).toHaveBeenCalledTimes(1);
  expect(calls).toBe(2);
}, 30_000);

async function drain(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

// Another process called recover(runId). The process that started the run must stop waiting on it, and must not
// refuse its own later recover() as a run it is still executing.
it('settles the original execution of a pubsub-owned run that another process took over', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const storage = new InMemoryStore();
  const workflowsStore = await guardedWorkflowsStore(storage);
  const { agent, pubsub } = createPubsubOwnedAgent({ storage });
  const started = await agent.stream('Answer.');
  const { runId } = started;
  const ended = drain(started.fullStream).then(
    chunks => chunks.map(chunk => chunk.type),
    () => ['rejected'],
  );
  // vi.waitFor polls with the faked setInterval, so poll with setTimeout.
  const poll = async (done: () => boolean) => {
    for (let waited = 0; !done() && waited < 15_000; waited += 50) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  };
  const execute = vi.spyOn(EventedExecutionEngine.prototype, 'execute');
  await poll(() => execute.mock.calls.length > 0);
  const coordinator = ExecutionFence.getLocalActive(runId)!;
  expect(coordinator.pubsubOwned).toBe(true);

  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId,
    mode: 'takeover',
    pubsubOwned: true,
  });
  onTestFinished(() => successor.detach());
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS * 3);
  expect(coordinator.isLost()).toBe(true);
  // The run's execution settles here and lets go of the run. Its stream stays open for the new owner's events.
  await poll(() => coordinator.settlement !== undefined);
  expect(coordinator.settlement).toBe('superseded');
  // The successor claimed in this process too, so only it may count as this process's execution of the run.
  expect(ExecutionFence.getLocalActive(runId)).toBe(successor);
  expect(await Promise.race([ended, Promise.resolve('open')])).toBe('open');
}, 30_000);

// observe() stays attached to a run another process drives, even before it streamed anything and long after its
// claim was made: an unreleased pubsub-owned claim holds the run however old it is.
it('keeps observing a pubsub-owned run with no stream history and an old, unreleased claim', async () => {
  const storage = new InMemoryStore();
  const workflowsStore = await guardedWorkflowsStore(storage);
  const { agent, pubsub } = createPubsubOwnedAgent({ storage });
  const fence = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'observed-run',
    mode: 'acquire',
    pubsubOwned: true,
  });
  fence.detach();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + EXECUTION_LEASE_TTL_MS * 3);
  expect((await workflowsStore.getRunOwnership({ runId: 'observed-run' }))?.live).toBe(false);

  const observed = await agent.observe('observed-run');
  onTestFinished(() => observed.detach());
  const closed = (async () => {
    for await (const _chunk of observed.fullStream) {
      // Drain.
    }
    return 'closed';
  })();
  expect(await Promise.race([closed, new Promise(resolve => setTimeout(() => resolve('open'), 300))])).toBe('open');
});

// Shutdown of the process that called recover() must not abandon the run: automatic recovery leaves pubsub-owned
// runs to the broker, so an abandoned one would never run again.
it('detaches a pubsub-owned coordinator on shutdown instead of abandoning its run', async () => {
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const pubsub = sharedBroker({ leases: true, redeliversUnacked: true }).connect();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  instances.push(mastra);
  const fence = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'recovered-run',
    mode: 'acquire',
    pubsubOwned: true,
  });
  const claimed = await workflowsStore.getRunOwnership({ runId: 'recovered-run' });
  // A recovery's registry entry is not marked as a shared evented execution.
  setRunRegistryEntry('recovered-run', { tools: {}, model: 'openai/gpt-4o', executionFence: fence }, mastra);
  onTestFinished(() => deleteRunRegistryEntry('recovered-run', mastra));
  await abandonDurableAgentExecutions(mastra);
  expect(await workflowsStore.getRunOwnership({ runId: 'recovered-run' })).toEqual(claimed);
  expect(ExecutionFence.getLocalActive('recovered-run')).toBeUndefined();
});

it('carries pubsub ownership on a claim only with a storage generation', () => {
  const context = new RequestContext();
  context.setRaw(MASTRA_DURABLE_EXECUTIONS_KEY, {
    fenced: { executionId: 'a', agentId: 'agent', generation: 3, pubsubOwned: true },
    leased: { executionId: 'b', agentId: 'agent', pubsubOwned: true },
  });
  expect(getExecutionClaim(context, 'fenced')).toMatchObject({ generation: 3, pubsubOwned: true });
  expect(getExecutionClaim(context, 'leased')).not.toHaveProperty('pubsubOwned');
});

it('runs an evented workflow on the supported multi-process setup without claiming or renewing a run lease', async () => {
  const storage = new InMemoryStore();
  const workflowsStore = await guardedWorkflowsStore(storage);
  const claims = vi.spyOn(workflowsStore, 'claimRunOwnership');
  const renewals = vi.spyOn(workflowsStore, 'renewRunOwnership');
  const step = createStep({
    id: 'double',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ value: z.number() }),
    execute: async ({ inputData }) => ({ value: inputData.value * 2 }),
  });
  const workflow = createWorkflow({
    id: 'evented-no-lease',
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ value: z.number() }),
  })
    .then(step)
    .commit();
  const pubsub = sharedBroker({ leases: true, redeliversUnacked: true }).connect();
  const mastra = new Mastra({ workflows: { workflow }, storage, pubsub, logger: false });
  instances.push(mastra);
  expect(await pubsubOwnsEventedRuns(mastra.pubsub, workflowsStore)).toBe(true);
  await mastra.startWorkers();

  const run = await mastra.getWorkflow('workflow').createRun();
  const result = await run.start({ inputData: { value: 2 } });
  expect(result).toMatchObject({ status: 'success', result: { value: 4 } });
  expect(claims).not.toHaveBeenCalled();
  expect(renewals).not.toHaveBeenCalled();
  expect(await workflowsStore.getRunOwnership({ runId: run.runId })).toBeNull();
});
