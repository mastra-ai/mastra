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
import { createStep, createWorkflow } from '../../workflows/evented';
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
  ExecutionFence,
  getExecutionOwnershipGuard,
  MASTRA_DURABLE_EXECUTIONS_KEY,
  RUN_ACTIVE_ERROR_ID,
  withExecutionFence,
} from './execution-fence';

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
  const renewals = vi.spyOn(workflowsStore, 'renewRunOwnership');

  expect(await participateInDurableExecution(mastra, event, async () => 'first')).toBe('first');
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
  expect(coordinator.isLost()).toBe(false);
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

// Recovery can't tell a live chain of deliveries from a stuck one without a timer, so an explicit recover() takes
// the run over at once. The same claim without pubsub ownership is still refused.
it.each([true, false])('recovers a run whose claim was never renewed (pubsub-owned: %s)', async pubsubOwned => {
  const { workflowsStore, pubsub, coordinator } = await createPubsubOwnedExecution();
  const recover = ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'recover',
    pubsubOwned,
  });
  if (!pubsubOwned) {
    await expect(recover).rejects.toMatchObject({ id: RUN_ACTIVE_ERROR_ID });
    return;
  }
  const recovered = await recover;
  onTestFinished(() => recovered.detach());
  expect(recovered.generation).toBeGreaterThan(coordinator.generation!);
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
  await vi.waitFor(async () =>
    expect(await workflowsStore.loadWorkflowRunStatus({ workflowName: DurableStepIds.AGENTIC_LOOP, runId })).toBe(
      'running',
    ),
  );
  const claimed = (await workflowsStore.getRunOwnership({ runId }))!;

  expect(await agent.recoverActiveRuns()).toEqual({ recovered: [], succeeded: 0, failed: 0 });
  expect(await mastra.recoverAllDurableAgents()).toMatchObject({ recovered: 0, skipped: 0, failed: 0 });
  expect(await workflowsStore.getRunOwnership({ runId })).toEqual(claimed);

  // The claim is still unexpired, which would refuse a lease-backed recovery. Recover as another process would:
  // this one still refuses a run it executes.
  expect(claimed.live).toBe(true);
  __resetExecutionFencesForTests();
  const recovered = await agent.recover(runId);
  onTestFinished(() => recovered.cleanup());
  expect((await workflowsStore.getRunOwnership({ runId }))?.generation).toBeGreaterThan(claimed.generation);
});

it('runs an evented workflow without claiming or renewing a run lease', async () => {
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
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
  const mastra = new Mastra({ workflows: { workflow }, storage, pubsub: new EventEmitterPubSub(), logger: false });
  instances.push(mastra);
  await mastra.startWorkers();

  const run = await mastra.getWorkflow('workflow').createRun();
  const result = await run.start({ inputData: { value: 2 } });
  expect(result).toMatchObject({ status: 'success', result: { value: 4 } });
  expect(claims).not.toHaveBeenCalled();
  expect(renewals).not.toHaveBeenCalled();
  expect(await workflowsStore.getRunOwnership({ runId: run.runId })).toBeNull();
});
