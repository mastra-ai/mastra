import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { ToolStream } from '../../../tools/stream';
import { PUBSUB_SYMBOL } from '../../../workflows/constants';
import {
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  __resetExecutionFencesForTests,
  assertExecutionNotSuperseded,
  assertExecutionOwned,
  executionLeaseKey,
  getExecutionOwnershipGuard,
  resolveLeaseProvider,
  setExecutionClaim,
  withExecutionFence,
} from '../execution-fence';

const runId = 'ownership-wrapper-run';
const agentId = 'ownership-wrapper-agent';
const pubsubs: EventEmitterPubSub[] = [];

async function fixture(backend: 'storage' | 'lease', remote = true) {
  const storage = new InMemoryStore();
  const workflows = storage.stores.workflows!;
  if (backend === 'lease') vi.spyOn(workflows, 'supportsRunFencing').mockReturnValue(false);
  const pubsub = new EventEmitterPubSub();
  pubsubs.push(pubsub);
  const leases = resolveLeaseProvider(pubsub);
  const mastra = new Mastra({ storage, pubsub, logger: false });
  const fence = await ExecutionFence.claim({
    agentId,
    runId,
    leaseProvider: leases,
    workflowsStore: workflows,
    mode: 'acquire',
  });
  const requestContext = new RequestContext();
  setExecutionClaim(requestContext, runId, fence.claim);
  if (remote) __resetExecutionFencesForTests();
  const renewStorage = vi.spyOn(workflows, 'renewRunOwnership');
  const releaseStorage = vi.spyOn(workflows, 'releaseRunOwnership');
  const renewLease = vi.spyOn(leases, 'renewLease');
  const releaseLease = vi.spyOn(leases, 'releaseLease');
  const readStorage = vi.spyOn(workflows, 'getRunOwnership');
  const readLease = vi.spyOn(leases, 'getLeaseOwner');
  const args = { agentId, runId, mastra, requestContext };
  const params = { ...args, getInitData: () => ({ agentId, runId }), [PUBSUB_SYMBOL]: pubsub };
  const expectNoMutations = () => {
    expect(renewStorage).not.toHaveBeenCalled();
    expect(releaseStorage).not.toHaveBeenCalled();
    expect(renewLease).not.toHaveBeenCalled();
    expect(releaseLease).not.toHaveBeenCalled();
  };
  const takeOver = async () => {
    if (backend === 'storage') {
      expect(
        (await workflows.claimRunOwnership({ runId, ownerId: 'successor', force: true, leaseMs: 60_000 })).acquired,
      ).toBe(true);
    } else {
      expect(
        await leases.transferLease(executionLeaseKey(agentId, runId), fence.executionId, 'successor', 60_000),
      ).toBe(true);
    }
  };
  return {
    storage,
    workflows,
    pubsub,
    leases,
    mastra,
    fence,
    args,
    params,
    expectNoMutations,
    takeOver,
    readStorage,
    readLease,
  };
}

afterEach(async () => {
  __resetExecutionFencesForTests();
  vi.restoreAllMocks();
  await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  vi.useRealTimers();
});

describe.each(['storage', 'lease'] as const)('durable ownership wrapper using %s (COR-1473)', backend => {
  it('observes remotely at entry, during execution, at save boundaries, and on return without renewing or releasing', async () => {
    vi.useFakeTimers();
    const context = await fixture(backend);
    const execute = vi.fn(async (params: object) => {
      const guard = getExecutionOwnershipGuard(params)!;
      expect(guard).toBeDefined();
      expect(guard.isLost()).toBe(false);
      await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
      await assertExecutionOwned(context.args);
      return 'done';
    });
    const step = withExecutionFence({ execute });
    await expect(step.execute(context.params)).resolves.toBe('done');
    const read = backend === 'storage' ? context.readStorage : context.readLease;
    expect(read.mock.calls.length).toBeGreaterThanOrEqual(4);
    context.expectNoMutations();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a remote invocation on observed takeover without touching the successor claim', async () => {
    vi.useFakeTimers();
    const context = await fixture(backend);
    const step = withExecutionFence({
      execute: async (params: object) => {
        const guard = getExecutionOwnershipGuard(params)!;
        const signal = guard.composeSignal(undefined);
        await context.takeOver();
        await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
        expect(signal.aborted).toBe(true);
        expect(signal.reason).toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
        return 'stale';
      },
    });
    await expect(step.execute(context.params)).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
    context.expectNoMutations();
    if (backend === 'storage') {
      expect(await context.workflows.getRunOwnership({ runId })).toMatchObject({ ownerId: 'successor', live: true });
    } else {
      expect(await context.leases.getLeaseOwner(executionLeaseKey(agentId, runId))).toBe('successor');
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps released-claim late saves valid until a successor appears', async () => {
    const context = await fixture(backend);
    if (backend === 'storage') {
      await context.workflows.releaseRunOwnership({
        runId,
        ownerId: context.fence.executionId,
        generation: context.fence.generation!,
      });
    } else {
      await context.leases.releaseLease(executionLeaseKey(agentId, runId), context.fence.executionId);
    }
    vi.clearAllMocks();
    await expect(assertExecutionNotSuperseded(context.args)).resolves.toBeUndefined();
    await expect(assertExecutionOwned(context.args)).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
    if (backend === 'storage') {
      await context.takeOver();
    } else {
      expect((await context.leases.acquireLease(executionLeaseKey(agentId, runId), 'successor', 60_000)).acquired).toBe(
        true,
      );
    }
    await expect(assertExecutionNotSuperseded(context.args)).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
    context.expectNoMutations();
  });

  it('drops writes from a stream writer captured before ownership loss', async () => {
    vi.useFakeTimers();
    const context = await fixture(backend);
    const publish = vi.fn().mockResolvedValue(undefined);
    const writer = new ToolStream({ prefix: 'workflow-step', callId: 'step', name: 'step', runId }, publish);
    const step = withExecutionFence({
      execute: async (params: { writer: ToolStream }) => {
        const captured = params.writer.getWriter();
        try {
          await captured.write('before');
          expect(publish).toHaveBeenCalledTimes(1);
          await context.takeOver();
          await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
          await captured.write('after');
          await params.writer.write('after-direct');
          await params.writer.custom({ type: 'data-stale', data: 'after-custom' });
          expect(publish).toHaveBeenCalledTimes(1);
        } finally {
          captured.releaseLock();
        }
      },
    });
    await expect(step.execute({ ...context.params, writer })).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
    context.expectNoMutations();
    expect(writer.locked).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses the captured execution identity rather than a replacement local fence', async () => {
    const context = await fixture(backend, false);
    const replacement = await ExecutionFence.claim({
      agentId,
      runId,
      leaseProvider: context.leases,
      workflowsStore: context.workflows,
      mode: 'takeover',
    });
    const execute = vi.fn(async () => 'should not start');
    await expect(withExecutionFence({ execute }).execute(context.params)).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(replacement.isLost()).toBe(false);
    const replacementContext = new RequestContext();
    setExecutionClaim(replacementContext, runId, replacement.claim);
    await expect(
      withExecutionFence({ execute: async () => 'replacement' }).execute({
        ...context.params,
        requestContext: replacementContext,
      }),
    ).resolves.toBe('replacement');
    expect(replacement.isLost()).toBe(false);
  });
});

it('preserves the unfenced step path when there is no execution claim', async () => {
  const params = { getInitData: () => ({ runId, agentId }), requestContext: new RequestContext() };
  const execute = vi.fn(async (received: object) => {
    expect(received).toBe(params);
    expect(getExecutionOwnershipGuard(received)).toBeUndefined();
    return 'unfenced';
  });
  await expect(withExecutionFence({ execute }).execute(params)).resolves.toBe('unfenced');
  expect(execute).toHaveBeenCalledOnce();
});
