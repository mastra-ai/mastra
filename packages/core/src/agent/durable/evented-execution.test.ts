import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { createWorkflow } from '../../workflows/evented';
import { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import {
  participateInDurableExecution,
  retrySettledDurableExecution,
  settleEventedDurableExecution,
  stopDurableExecutionParticipants,
} from './evented-execution';
import {
  __resetExecutionFencesForTests,
  EXECUTION_LEASE_TTL_MS,
  EXECUTION_SUPERSEDED_ERROR_ID,
  EXECUTION_UNVERIFIED_ERROR_ID,
  ExecutionFence,
  getExecutionOwnershipGuard,
  withExecutionFence,
  executionLeaseKey,
  MASTRA_DURABLE_EXECUTIONS_KEY,
} from './execution-fence';

import { abandonDurableAgentExecutions, deleteRunRegistryEntry, setRunRegistryEntry } from './run-registry';

it('detaches a registered shared coordinator on API shutdown without releasing its live claim', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-shutdown-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  const workflowsStore = (await storage.getStore('workflows'))!;
  const fence = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'shutdown-run',
    mode: 'acquire',
  });
  try {
    setRunRegistryEntry(
      'shutdown-run',
      { tools: {}, model: 'openai/gpt-4o', executionFence: fence, eventedExecution: true },
      mastra,
    );
    await abandonDurableAgentExecutions(mastra);
    const ownership = await workflowsStore.getRunOwnership({ runId: 'shutdown-run' });
    expect(ownership).toMatchObject({ live: true, ownerId: fence.executionId, generation: fence.generation });
    expect(ownership?.leaseExpiresAt).not.toBeNull();
  } finally {
    fence.stopHeartbeat();
    deleteRunRegistryEntry('shutdown-run', mastra);
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it.each([false, true])(
  'acknowledges unfenced terminal redelivery without releasing the coordinator lease (stale fenced context=%s)',
  async staleContext => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-unfenced-'));
    const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
    const storage = new InMemoryStore();
    const mastra = new Mastra({ storage, pubsub, logger: false });
    const coordinator = await ExecutionFence.claim({
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode: 'acquire',
    });
    const previous = await ExecutionFence.claim({
      workflowsStore: (await storage.getStore('workflows'))!,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'previous-run',
      mode: 'acquire',
    });
    await previous.settle(async () => {});
    const workflow = createWorkflow({
      id: 'durable-agentic-loop',
      inputSchema: z.any(),
      outputSchema: z.any(),
    }).commit();
    mastra.__registerInternalWorkflow(workflow, 'run');
    const event: Event = {
      id: 'terminal',
      type: 'workflow.end',
      runId: 'run',
      createdAt: new Date(),
      data: {
        workflowId: workflow.id,
        runId: 'run',
        executionPath: [],
        resumeSteps: [],
        stepResults: {},
        activeStepsPath: {},
        requestContext: {
          [MASTRA_DURABLE_EXECUTIONS_KEY]: {
            ...(staleContext ? { 'previous-run': previous.claim } : {}),
            run: coordinator.claim,
          },
        },
        prevResult: { status: 'success', output: {}, payload: {}, startedAt: 1, endedAt: 2 },
      },
    };
    try {
      expect(await new WorkflowEventProcessor({ mastra }).handle(event)).toEqual({ ok: true });
      expect(mastra.__hasInternalWorkflow(workflow.id, 'run')).toBe(false);
      expect(await pubsub.getLeaseOwner(executionLeaseKey('agent', 'run'))).toBe(coordinator.executionId);
      await coordinator.settle(async () => {});
      expect(await new WorkflowEventProcessor({ mastra }).handle(event)).toEqual({ ok: true });
    } finally {
      coordinator.stopHeartbeat();
      await stopDurableExecutionParticipants(mastra);
      await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

const instances: Mastra[] = [];
afterEach(async () => {
  for (const mastra of instances.splice(0)) {
    await stopDurableExecutionParticipants(mastra);
    await mastra.pubsub.close();
  }
  __resetExecutionFencesForTests();
  vi.useRealTimers();
});

async function createExecution(storageBacked = true) {
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({ storage, pubsub });
  instances.push(mastra);
  const coordinator = await ExecutionFence.claim({
    workflowsStore: storageBacked ? workflowsStore : undefined,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  coordinator.stopHeartbeat();
  const event: Event = {
    id: 'delivery',
    type: 'workflow.step.run',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: 'durable-agentic-loop',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim } },
    },
  };
  return { workflowsStore, pubsub, mastra, coordinator, event };
}

it("keeps a remote claim alive across broker gaps, ignoring a different execution's finish", async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createExecution();
  await participateInDurableExecution(mastra, event, async () => {});
  await pubsub.publish('workflows-finish', {
    type: 'workflow.end',
    runId: 'run',
    data: {
      ...event.data,
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: { ...coordinator.claim, executionId: 'different' } } },
    },
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    live: true,
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
  });
  await pubsub.publish('workflows-finish', { type: 'workflow.end', runId: 'run', data: event.data });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({ live: true });
  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({ live: false });
});

it('rejects a stale root terminal before its handler can mutate a successor', async () => {
  const { workflowsStore, pubsub, mastra, event } = await createExecution();
  await participateInDurableExecution(mastra, event, async () => {});
  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'takeover',
  });
  const handler = vi.fn(async () => {});
  await expect(
    participateInDurableExecution(mastra, { ...event, type: 'workflow.end' }, handler),
  ).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  expect(handler).not.toHaveBeenCalled();
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: successor.executionId,
    live: true,
  });
});

it('retries conditional terminal cleanup after release without renewing or transferring ownership', async () => {
  const { workflowsStore, mastra, event, coordinator } = await createExecution();
  const terminal = { ...event, type: 'workflow.end' };
  await participateInDurableExecution(mastra, event, async () => {});
  await settleEventedDurableExecution(mastra, terminal);
  expect(await retrySettledDurableExecution(mastra, terminal)).toBe(true);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
});

it('retries thread cleanup on a fresh worker after interruption between terminal lease releases', async () => {
  const { workflowsStore, pubsub, mastra, event, coordinator } = await createExecution();
  const threadKey = 'resource\u0000thread';
  await agentThreadStreamRuntime.claimDurableThreadLease(pubsub, 'run', 'thread', 'resource', coordinator.generation);
  event.data.requestContext[MASTRA_DURABLE_EXECUTIONS_KEY].run = {
    ...coordinator.claim,
    threadId: 'thread',
    resourceId: 'resource',
  };
  const terminal = { ...event, type: 'workflow.end' };
  vi.spyOn(agentThreadStreamRuntime, 'releaseDurableThreadLease').mockRejectedValueOnce(new Error('worker stopped'));
  await expect(settleEventedDurableExecution(mastra, terminal)).rejects.toThrow('worker stopped');
  const freshWorker = new Mastra({ storage: mastra.getStorage(), pubsub, logger: false });
  await expect(retrySettledDurableExecution(freshWorker, terminal)).resolves.toBe(true);
  expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined();
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({ leaseExpiresAt: null });
});

it('keeps cancellation alive until its committed end delivery is handled', async () => {
  const { workflowsStore, mastra, event, coordinator } = await createExecution();
  await participateInDurableExecution(mastra, event, async () => {});
  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.cancel' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    live: true,
    ownerId: coordinator.executionId,
  });
  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({ leaseExpiresAt: null });
});

it.each(['expired', 'foreign'] as const)(
  'classifies a %s lease-backed worker claim without acknowledging uncertainty',
  async state => {
    const { pubsub, mastra, event, coordinator } = await createExecution(false);
    await pubsub.releaseLease(executionLeaseKey('agent', 'run'), coordinator.executionId);
    if (state === 'foreign')
      await pubsub.acquireLease(executionLeaseKey('agent', 'run'), 'successor', EXECUTION_LEASE_TTL_MS);
    await expect(participateInDurableExecution(mastra, event, async () => {})).rejects.toMatchObject({
      id: state === 'foreign' ? EXECUTION_SUPERSEDED_ERROR_ID : EXECUTION_UNVERIFIED_ERROR_ID,
    });
  },
);

it('stops admitting work after losing the captured thread lease', async () => {
  vi.useFakeTimers();
  const { pubsub, mastra, event, coordinator } = await createExecution();
  await agentThreadStreamRuntime.claimDurableThreadLease(pubsub, 'run', 'thread', 'resource', coordinator.generation);
  event.data.requestContext[MASTRA_DURABLE_EXECUTIONS_KEY].run = {
    ...coordinator.claim,
    threadId: 'thread',
    resourceId: 'resource',
  };
  await participateInDurableExecution(mastra, event, async () => {});
  const key = 'resource\u0000thread';
  const owner = await pubsub.getLeaseOwner(key);
  await pubsub.transferLease(key, owner!, 'another-run', EXECUTION_LEASE_TTL_MS * 3);
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS + 1);
  await expect(participateInDurableExecution(mastra, event, async () => {})).rejects.toMatchObject({
    id: EXECUTION_UNVERIFIED_ERROR_ID,
  });
});

it('releases lease-backed executions when the terminal worker settles them', async () => {
  const { pubsub, mastra, event, coordinator } = await createExecution(false);
  const key = executionLeaseKey('agent', 'run');
  await participateInDurableExecution(mastra, event, async () => {});
  expect(await pubsub.getLeaseOwner(key)).toBe(coordinator.executionId);
  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' });
  expect(await pubsub.getLeaseOwner(key)).toBeUndefined();
});

it('preserves the thread lease when recovery takes over between terminal validation and release', async () => {
  const { workflowsStore, pubsub, mastra, event, coordinator } = await createExecution();
  const threadKey = 'resource\u0000thread';
  await agentThreadStreamRuntime.claimDurableThreadLease(pubsub, 'run', 'thread', 'resource', coordinator.generation!);
  event.data.requestContext[MASTRA_DURABLE_EXECUTIONS_KEY].run = {
    ...coordinator.claim,
    threadId: 'thread',
    resourceId: 'resource',
  };
  const releaseLease = pubsub.releaseLease.bind(pubsub);
  let successor: ExecutionFence | undefined;
  vi.spyOn(pubsub, 'releaseLease').mockImplementation(async (key, owner) => {
    if (key === threadKey) {
      successor = await ExecutionFence.claim({
        workflowsStore,
        leaseProvider: pubsub,
        agentId: 'agent',
        runId: 'run',
        mode: 'takeover',
      });
      await agentThreadStreamRuntime.claimDurableThreadLease(
        pubsub,
        'run',
        'thread',
        'resource',
        successor.generation!,
      );
    }
    return releaseLease(key, owner);
  });
  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: successor?.executionId,
    live: true,
  });
  expect(await pubsub.getLeaseOwner(threadKey)).toBe(
    `mastra:thread-lease:${JSON.stringify(['run', 'generation', successor?.generation])}`,
  );
});

it('does not release a successor thread token on lease-only stores', async () => {
  const { pubsub, mastra, event, coordinator } = await createExecution(false);
  const key = 'resource\u0000thread';
  await agentThreadStreamRuntime.claimDurableThreadLease(
    pubsub,
    'run',
    'thread',
    'resource',
    undefined,
    coordinator.executionId,
  );
  event.data.requestContext[MASTRA_DURABLE_EXECUTIONS_KEY].run = {
    ...coordinator.claim,
    threadId: 'thread',
    resourceId: 'resource',
  };
  const oldOwner = await pubsub.getLeaseOwner(key);
  const successorOwner = 'mastra:thread-lease:["run","execution","successor"]';
  const release = pubsub.releaseLease.bind(pubsub);
  vi.spyOn(pubsub, 'releaseLease').mockImplementation(async (releasedKey, owner) => {
    if (releasedKey === key) await pubsub.transferLease(key, oldOwner!, successorOwner, EXECUTION_LEASE_TTL_MS);
    return release(releasedKey, owner);
  });
  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' });
  expect(await pubsub.getLeaseOwner(key)).toBe(successorOwner);
});

it.each([true, false])(
  'releases the execution-qualified thread lease immediately on normal completion (storage=%s)',
  async storageBacked => {
    const { pubsub, mastra, event, coordinator } = await createExecution(storageBacked);
    const threadKey = 'resource\u0000thread';
    await agentThreadStreamRuntime.claimDurableThreadLease(
      pubsub,
      'run',
      'thread',
      'resource',
      coordinator.generation,
      coordinator.executionId,
    );
    event.data.requestContext[MASTRA_DURABLE_EXECUTIONS_KEY].run = {
      ...coordinator.claim,
      threadId: 'thread',
      resourceId: 'resource',
    };
    await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' });
    expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined();
    expect(await pubsub.acquireLease(threadKey, 'next-run', EXECUTION_LEASE_TTL_MS)).toMatchObject({ acquired: true });
  },
);

it('interrupts only the shutting-down worker invocation and leaves its delivery retryable', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, event } = await createExecution();
  const survivor = new Mastra({ storage: mastra.getStorage(), pubsub });
  instances.push(survivor);
  await participateInDurableExecution(survivor, event, async () => {});
  let entered!: () => void;
  const started = new Promise<void>(resolve => {
    entered = resolve;
  });
  const step = withExecutionFence({
    execute: async (params: object) => {
      const signal = getExecutionOwnershipGuard(params)!.composeSignal(undefined);
      entered();
      await new Promise<void>((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
      );
    },
  });
  const delivery = participateInDurableExecution(mastra, event, () =>
    step.execute({
      mastra,
      requestContext: new RequestContext(Object.entries(event.data.requestContext)),
      getInitData: () => ({ runId: 'run', agentId: 'agent' }),
    }),
  );
  const rejected = expect(delivery).rejects.toMatchObject({ id: EXECUTION_UNVERIFIED_ERROR_ID });
  await started;
  await stopDurableExecutionParticipants(mastra);
  await rejected;
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({ live: true });
});

it('detaches worker participants on shutdown without invalidating a surviving participant', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, event, coordinator } = await createExecution();
  const survivor = new Mastra({ storage: mastra.getStorage(), pubsub });
  instances.push(survivor);
  await participateInDurableExecution(mastra, event, async () => {});
  await participateInDurableExecution(survivor, event, async () => {});
  await stopDurableExecutionParticipants(mastra);
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_TTL_MS * 2);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    live: true,
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
  });
});
