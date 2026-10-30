import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { Event } from '../../events/types';
import { UnixSocketPubSub } from '../../events/unix-socket-pubsub';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import { resolveRunFence, runOutsideRunFenceScope, RUN_FENCE_CONFLICT_ERROR_ID } from '../../storage/run-fencing';
import type { RunFence } from '../../storage/run-fencing';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows/evented';
import { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { createEventedAgent } from './create-evented-agent';
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
  getExecutionClaimScope,
  isStorageFencedExecution,
  withExecutionFence,
  executionLeaseKey,
  MASTRA_DURABLE_EXECUTIONS_KEY,
} from './execution-fence';

import {
  abandonDurableAgentExecutions,
  deleteRunRegistryEntry,
  getRunRegistryEntry,
  setRunRegistryEntry,
} from './run-registry';

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

it('keeps a shared EventedAgent.stream() run owned by its worker when the API shuts down', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-api-loss-'));
  const socket = join(directory, 'pubsub.sock');
  const storage = new InMemoryStore();
  const workflows = (await storage.getStore('workflows'))!;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  // The reply must block deterministically on the worker while the API shuts down.
  const { model } = deliveryModel('worker answer', undefined, async () => {
    entered.resolve();
    await release.promise;
  });
  const memory = new MockMemory({ storage });
  const build = (pubsub: UnixSocketPubSub) =>
    createEventedAgent({
      agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Answer.', model, memory }),
      pubsub,
    });
  const apiPubsub = new UnixSocketPubSub(socket);
  const workerPubsub = new UnixSocketPubSub(socket);
  const apiAgent = build(apiPubsub);
  const api = new Mastra({ agents: { agent: apiAgent }, storage, pubsub: apiPubsub, workers: false, logger: false });
  const worker = new Mastra({ agents: { agent: build(workerPubsub) }, storage, pubsub: workerPubsub, logger: false });
  const threadKey = 'resource\u0000thread';
  try {
    await worker.startWorkers();
    const { runId } = await apiAgent.stream('Answer the question.', {
      runId: 'api-loss-run',
      memory: { resource: 'resource', thread: 'thread' },
    });
    await entered.promise;
    expect(getRunRegistryEntry(runId, api)?.eventedExecution).toBe(true);
    const claimed = await workflows.getRunOwnership({ runId });
    expect(claimed).toMatchObject({ live: true });
    const threadOwner = `mastra:thread-lease:${JSON.stringify([runId, 'generation', claimed!.generation])}`;
    expect(await workerPubsub.getLeaseOwner(threadKey)).toBe(threadOwner);

    await api.shutdown();
    expect(await workflows.getRunOwnership({ runId })).toMatchObject({
      live: true,
      ownerId: claimed!.ownerId,
      generation: claimed!.generation,
    });
    expect(await workerPubsub.getLeaseOwner(threadKey)).toBe(threadOwner);

    release.resolve();
    await vi.waitFor(
      async () => {
        expect(await workflows.getRunOwnership({ runId })).toMatchObject({
          ownerId: claimed!.ownerId,
          generation: claimed!.generation,
          leaseExpiresAt: null,
          live: false,
        });
        expect(await workerPubsub.getLeaseOwner(threadKey)).toBeUndefined();
      },
      { timeout: 5_000 },
    );
  } finally {
    release.resolve();
    await api.shutdown();
    await worker.shutdown();
    await apiPubsub.close();
    await workerPubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);

it.each([
  { staleContext: false, directClaim: true },
  { staleContext: true, directClaim: true },
  { staleContext: false, directClaim: false },
  { staleContext: true, directClaim: false },
])(
  'handles unfenced terminal redelivery without releasing the coordinator lease ($staleContext stale, $directClaim direct)',
  async ({ staleContext, directClaim }) => {
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
            ...(directClaim ? { run: coordinator.claim } : {}),
          },
        },
        prevResult: { status: 'success', output: {}, payload: {}, startedAt: 1, endedAt: 2 },
      },
    };
    const published = vi.spyOn(pubsub, 'publish');
    const followed = vi.spyOn(ExecutionFence, 'follow');
    try {
      expect(await participateInDurableExecution(mastra, event, async () => 'delivered')).toBe('delivered');
      expect(followed.mock.calls.map(([, runId]) => runId)).toEqual(directClaim ? ['run'] : []);
      expect(await new WorkflowEventProcessor({ mastra }).handle(event)).toEqual({ ok: true });
      expect(
        published.mock.calls.some(([topic, delivery]) => topic === 'workflows-finish' && delivery.runId === 'run'),
      ).toBe(true);
      expect(mastra.__hasInternalWorkflow(workflow.id, 'run')).toBe(false);
      expect(await pubsub.getLeaseOwner(executionLeaseKey('agent', 'run'))).toBe(coordinator.executionId);
      await coordinator.settle(async () => {});
      expect(await new WorkflowEventProcessor({ mastra }).handle(event)).toEqual({ ok: true });
    } finally {
      coordinator.stopHeartbeat();
      await stopDurableExecutionParticipants(mastra);
      published.mockRestore();
      followed.mockRestore();
      await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

function deliveryModel(text: string, toolName?: string, beforeReply?: () => Promise<void>) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const call = prompts.push(JSON.stringify(prompt));
      await beforeReply?.();
      const callsTool = call === 1 && toolName;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          ...(callsTool
            ? [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName, input: '{}' }]
            : [
                { type: 'text-start' as const, id: 'text' },
                { type: 'text-delta' as const, id: 'text', delta: text },
                { type: 'text-end' as const, id: 'text' },
              ]),
          {
            type: 'finish',
            finishReason: callsTool ? 'tool-calls' : 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
      };
    },
  });
  return { model, prompts };
}

it.each(['nested', 'sequential', 'concurrent'] as const)(
  'completes %s durable runs sharing context over the socket broker',
  async composition => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-composition-'));
    const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
    const storage = new InMemoryStore();
    const requestContext = new RequestContext();
    const parentEntered = Promise.withResolvers<void>();
    const childEntered = Promise.withResolvers<void>();
    const releaseParent = Promise.withResolvers<void>();
    const releaseChild = Promise.withResolvers<void>();
    const childModel = deliveryModel(
      'child answer',
      undefined,
      composition === 'concurrent'
        ? async () => {
            childEntered.resolve();
            await releaseChild.promise;
          }
        : undefined,
    );
    const child = createEventedAgent({
      agent: new Agent({ id: 'child', name: 'child', instructions: 'Answer.', model: childModel.model }),
      pubsub,
    });
    let delegatedRunId: string | undefined;
    const completedRunIds = new Set<string>();
    const readAnswer = async (output: Awaited<ReturnType<typeof child.stream>>) => {
      completedRunIds.add(output.runId);
      let answer = '';
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'text-delta') answer += chunk.payload.text;
        if (chunk.type === 'error') throw chunk.payload.error;
      }
      return answer;
    };
    const delegate = createTool({
      id: 'delegate',
      inputSchema: z.object({}),
      outputSchema: z.object({ answer: z.string() }),
      execute: async (_input, context) => {
        const output = await child.stream('Answer the child question.', { requestContext: context?.requestContext });
        delegatedRunId = output.runId;
        return { answer: await readAnswer(output) };
      },
    });
    const parentModel = deliveryModel(
      'parent answer',
      composition === 'nested' ? 'delegate' : undefined,
      composition === 'concurrent'
        ? async () => {
            parentEntered.resolve();
            await releaseParent.promise;
          }
        : undefined,
    );
    const parent = createEventedAgent({
      agent: new Agent({
        id: 'parent',
        name: 'parent',
        instructions: 'Answer.',
        model: parentModel.model,
        tools: composition === 'nested' ? { delegate } : {},
      }),
      pubsub,
    });
    const mastra = new Mastra({ agents: { parent, child }, storage, pubsub, logger: false });
    const workflows = (await storage.getStore('workflows'))!;
    const delivery = new AsyncLocalStorage<{ deliveryRunId: string; claimRunId: string | undefined }>();
    const writes: { deliveryRunId: string; claimRunId: string | undefined; fence: RunFence | undefined }[] = [];
    const handle = WorkflowEventProcessor.prototype.handle;
    const handleSpy = vi.spyOn(WorkflowEventProcessor.prototype, 'handle').mockImplementation(function (event) {
      const context = new RequestContext(Object.entries(event.data?.requestContext ?? {}));
      const claimRunId = getExecutionClaimScope(context, event.runId, event.data?.parentWorkflow)?.runId;
      return runOutsideRunFenceScope(() =>
        delivery.run({ deliveryRunId: event.runId, claimRunId }, () => handle.call(this, event)),
      );
    });
    const updateResults = workflows.updateWorkflowResults.bind(workflows);
    const resultsSpy = vi.spyOn(workflows, 'updateWorkflowResults').mockImplementation(args => {
      const current = delivery.getStore();
      if (current?.deliveryRunId === args.runId) {
        writes.push({ ...current, fence: resolveRunFence(workflows, args.fence, args.runId) });
      }
      return updateResults(args);
    });
    try {
      const first = await parent.stream('Answer the parent question.', { requestContext, runId: 'parent-run' });
      if (composition === 'concurrent') {
        const firstAnswer = readAnswer(first);
        await parentEntered.promise;
        const second = await child.stream('Answer concurrently.', { requestContext, runId: 'child-run' });
        const secondAnswer = readAnswer(second);
        await vi.waitFor(() => expect(childModel.prompts.length).toBeGreaterThan(0), { timeout: 2_000 });
        await childEntered.promise;
        releaseParent.resolve();
        expect(await firstAnswer).toBe('parent answer');
        await vi.waitFor(async () => {
          expect(await (await storage.getStore('workflows'))!.getRunOwnership({ runId: 'parent-run' })).toMatchObject({
            live: false,
          });
        });
        expect(await (await storage.getStore('workflows'))!.getRunOwnership({ runId: 'child-run' })).toMatchObject({
          live: true,
        });
        releaseChild.resolve();
        expect(await secondAnswer).toBe('child answer');
      } else {
        const firstAnswer = readAnswer(first);
        if (composition === 'nested') {
          await vi.waitFor(() => expect(childModel.prompts.length).toBeGreaterThan(0), { timeout: 2_000 });
        }
        expect(await firstAnswer).toBe('parent answer');
        if (composition === 'nested') {
          expect(parentModel.prompts).toHaveLength(2);
          expect(parentModel.prompts[1]).toContain('child answer');
          const nestedWrites = writes.filter(
            write => write.claimRunId === delegatedRunId && write.deliveryRunId !== delegatedRunId,
          );
          expect(nestedWrites.length).toBeGreaterThan(0);
          const ownership = await workflows.getRunOwnership({ runId: delegatedRunId! });
          for (const write of nestedWrites) {
            expect(write.fence).toEqual({
              runId: delegatedRunId,
              ownerId: ownership!.ownerId,
              generation: ownership!.generation,
            });
          }
        } else {
          const second = await child.stream('Answer the next question.', { requestContext, runId: 'child-run' });
          const secondAnswer = readAnswer(second);
          await vi.waitFor(() => expect(childModel.prompts.length).toBeGreaterThan(0), { timeout: 2_000 });
          expect(await secondAnswer).toBe('child answer');
          const childWrites = writes.filter(write => write.claimRunId === 'child-run');
          expect(childWrites.length).toBeGreaterThan(0);
          const ownership = await workflows.getRunOwnership({ runId: 'child-run' });
          for (const write of childWrites) {
            expect(write.fence).toEqual({
              runId: 'child-run',
              ownerId: ownership!.ownerId,
              generation: ownership!.generation,
            });
          }
        }
      }
      expect(childModel.prompts).toHaveLength(1);
      expect(completedRunIds.size).toBe(2);
      await vi.waitFor(async () => {
        for (const runId of completedRunIds) {
          expect(await workflows.getRunOwnership({ runId })).toMatchObject({ live: false });
        }
      });
    } finally {
      releaseParent.resolve();
      releaseChild.resolve();
      await mastra.shutdown();
      handleSpy.mockRestore();
      resultsSpy.mockRestore();
      delivery.disable();
      await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
  15_000,
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

it('fences only the explicitly declared ancestor chain, including unclaimed intermediate workflows', async () => {
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createExecution();
  const descendant: Event = {
    ...event,
    runId: 'leaf',
    data: {
      ...event.data,
      parentWorkflow: { runId: 'middle', parentWorkflow: { runId: 'run' } },
    },
  };
  await participateInDurableExecution(mastra, descendant, async () => {
    for (const runId of ['run', 'middle', 'leaf']) {
      expect(resolveRunFence(workflowsStore, undefined, runId)).toEqual({
        runId: 'run',
        generation: coordinator.generation,
        ownerId: coordinator.executionId,
      });
    }
    expect(resolveRunFence(workflowsStore, undefined, 'unrelated')).toBeUndefined();
    await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode: 'takeover',
    });
    await expect(workflowsStore.deleteWorkflowRunById({ workflowName: 'nested', runId: 'leaf' })).rejects.toMatchObject(
      {
        id: RUN_FENCE_CONFLICT_ERROR_ID,
      },
    );
  });
});

it('does not classify a claim without an agent identity as a storage-fenced delivery', async () => {
  const { mastra, workflowsStore, event, coordinator } = await createExecution();
  const claim = { executionId: coordinator.executionId, generation: coordinator.generation };
  const requestContext = new RequestContext([[MASTRA_DURABLE_EXECUTIONS_KEY, { run: claim }]]);
  expect(isStorageFencedExecution(requestContext, 'run')).toBe(false);
  await participateInDurableExecution(
    mastra,
    { ...event, data: { ...event.data, requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: claim } } } },
    async () => {
      expect(resolveRunFence(workflowsStore, undefined, 'run')).toBeUndefined();
    },
  );
});

it.each(['workflow.end', 'workflow.cancel'])(
  'rejects stale %s before its handler can mutate a successor',
  async type => {
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
    await expect(participateInDurableExecution(mastra, { ...event, type }, handler)).rejects.toMatchObject({
      id: EXECUTION_SUPERSEDED_ERROR_ID,
    });
    expect(handler).not.toHaveBeenCalled();
    expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
      ownerId: successor.executionId,
      live: true,
    });
  },
);

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

it('finalizes cancellation of a suspended run after its execution claim is released', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-cancel-released-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  const storage = new InMemoryStore();
  const workflow = createWorkflow({ id: 'durable-agentic-loop', inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(
      createStep({
        id: 'approval',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ suspend }) => suspend({}),
      }),
    )
    .commit();
  const mastra = new Mastra({ storage, pubsub, workflows: { workflow }, logger: false });
  instances.push(mastra);
  const workflows = (await storage.getStore('workflows'))!;
  const coordinator = await ExecutionFence.claim({
    workflowsStore: workflows,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'suspended-run',
    mode: 'acquire',
  });
  const requestContext = new RequestContext([[MASTRA_DURABLE_EXECUTIONS_KEY, { 'suspended-run': coordinator.claim }]]);
  const published = vi.spyOn(pubsub, 'publish');
  try {
    const run = await workflow.createRun({ runId: 'suspended-run' });
    await mastra.startWorkers();
    expect((await run.start({ inputData: {}, requestContext })).status).toBe('suspended');
    await vi.waitFor(async () => {
      expect(await workflows.getRunOwnership({ runId: run.runId })).toMatchObject({ leaseExpiresAt: null });
    });
    published.mockClear();
    const renewed = vi.spyOn(workflows, 'renewRunOwnership');
    const followed = vi.spyOn(ExecutionFence, 'follow');
    await run.cancel();
    await vi.waitFor(
      () => {
        expect(
          published.mock.calls.some(
            ([topic, event]) =>
              topic === 'workflows-finish' &&
              event.type === 'workflow.end' &&
              event.runId === run.runId &&
              event.data?.prevResult?.status === 'canceled',
          ),
        ).toBe(true);
      },
      { timeout: 2_000 },
    );
    expect(renewed).not.toHaveBeenCalled();
    expect(followed).not.toHaveBeenCalled();
    expect(published.mock.calls).toContainEqual([
      'workflow.control',
      expect.objectContaining({ type: 'workflow.control.abort', runId: run.runId }),
    ]);
    expect(published.mock.calls).toContainEqual([
      'workflows',
      expect.objectContaining({
        runId: run.runId,
        type: 'workflow.end',
        data: expect.objectContaining({ prevResult: expect.objectContaining({ status: 'canceled' }) }),
      }),
    ]);
    expect(await workflows.getRunOwnership({ runId: run.runId })).toMatchObject({
      ownerId: coordinator.executionId,
      generation: coordinator.generation,
      leaseExpiresAt: null,
      live: false,
    });
  } finally {
    coordinator.stopHeartbeat();
    await mastra.shutdown();
    published.mockRestore();
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 15_000);

it('does not admit a late step after the execution claim is released', async () => {
  const { mastra, event, coordinator } = await createExecution();
  await coordinator.settle(async () => true);
  let executed = false;
  await expect(
    participateInDurableExecution(mastra, event, async () => {
      executed = true;
    }),
  ).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  expect(executed).toBe(false);
});

it('does not abort local or remote successors when cancellation races a takeover', async () => {
  const { mastra, workflowsStore, pubsub, event, coordinator } = await createExecution();
  const local = new WorkflowEventProcessor({ mastra });
  const remote = new WorkflowEventProcessor({ mastra });
  await remote['ensureControlSubscription']();
  const releaseRemote = remote['retainRunsForStep'](['run']);
  const published = vi.spyOn(pubsub, 'publish');
  await coordinator.settle(async () => true);
  try {
    await participateInDurableExecution(mastra, { ...event, type: 'workflow.cancel' }, async () => {
      const successor = await ExecutionFence.claim({
        workflowsStore,
        leaseProvider: pubsub,
        agentId: 'agent',
        runId: 'run',
        mode: 'takeover',
      });
      const [localController, remoteController] = successor.run(
        () => [local['getOrCreateAbortController']('run'), remote['getOrCreateAbortController']('run')] as const,
      );
      await expect(
        local['processWorkflowCancel']({
          ...event.data,
          workflow: createWorkflow({
            id: event.data.workflowId,
            inputSchema: z.object({}),
            outputSchema: z.object({}),
          }).commit(),
          workflowId: event.data.workflowId,
          runId: 'run',
          executionPath: [],
          activeStepsPath: {},
          stepResults: {},
          resumeSteps: [],
          prevResult: { status: 'suspended', suspendPayload: {} },
          requestContext: event.data.requestContext,
        }),
      ).rejects.toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
      expect(localController.signal.aborted).toBe(false);
      expect(remoteController.signal.aborted).toBe(false);
      expect(published.mock.calls.some(([, delivery]) => delivery.type === 'workflow.end')).toBe(false);
      expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
        ownerId: successor.executionId,
        generation: successor.generation,
        live: true,
      });
    });
  } finally {
    releaseRemote();
    published.mockRestore();
  }
});

it.each(['local', 'remote'] as const)(
  'cancels independently claimed children without aborting successor attachments (%s)',
  async mode => {
    const { mastra, workflowsStore, pubsub, coordinator } = await createExecution();
    const processor = new WorkflowEventProcessor({ mastra });
    const release = processor['retainRunsForStep'](['run', 'child']);
    const parentWorkflow = { workflowId: 'durable-agentic-loop', runId: 'run', executionPath: [] };
    const firstChild = await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'child',
      runId: 'child',
      mode: 'acquire',
    });
    const child = await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'child',
      runId: 'child',
      mode: 'takeover',
    });
    firstChild.stopHeartbeat();
    const context = { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim, child: child.claim } };
    const cancel = () =>
      mode === 'local'
        ? processor['cancelRunAndChildren']('run', coordinator.generation)
        : processor['abortRunFromControl']('run', coordinator.generation);
    try {
      expect(child.generation).not.toBe(coordinator.generation);
      const controller = child.run(() => processor['getOrCreateAbortController']('child', context, parentWorkflow));
      processor['parentChildRelationships'].set('child', 'run');
      cancel();
      expect(controller.signal.aborted).toBe(true);

      const parentSuccessor = await ExecutionFence.claim({
        workflowsStore,
        leaseProvider: pubsub,
        agentId: 'agent',
        runId: 'run',
        mode: 'takeover',
      });
      const childSuccessor = await ExecutionFence.claim({
        workflowsStore,
        leaseProvider: pubsub,
        agentId: 'child',
        runId: 'child',
        mode: 'takeover',
      });
      const successorController = childSuccessor.run(() =>
        processor['getOrCreateAbortController'](
          'child',
          {
            [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: parentSuccessor.claim, child: childSuccessor.claim },
          },
          parentWorkflow,
        ),
      );
      cancel();
      expect(successorController.signal.aborted).toBe(false);
      expect(() => child.run(() => processor['getOrCreateAbortController']('child', context, parentWorkflow))).toThrow(
        expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }),
      );
    } finally {
      release();
    }
  },
);

it.each(['local', 'remote'] as const)(
  'refreshes child attachments when only its parent takes over (%s)',
  async mode => {
    const { mastra, workflowsStore, pubsub, coordinator } = await createExecution();
    const processor = new WorkflowEventProcessor({ mastra });
    const release = processor['retainRunsForStep'](['run', 'child']);
    const parentWorkflow = { workflowId: 'durable-agentic-loop', runId: 'run', executionPath: [] };
    const child = await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'child',
      runId: 'child',
      mode: 'acquire',
    });
    const context = { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim, child: child.claim } };
    const rootController = coordinator.run(() => processor['getOrCreateAbortController']('run', context));
    const original = child.run(() => processor['getOrCreateAbortController']('child', context, parentWorkflow));
    processor['parentChildRelationships'].set('child', 'run');
    await processor['ensureControlSubscription']();
    const cancel = async (generation: number) => {
      if (mode === 'local') processor['cancelRunAndChildren']('run', generation);
      else
        await pubsub.publish('workflow.control', {
          type: 'workflow.control.abort',
          runId: 'run',
          data: { generation },
        });
    };
    try {
      const parent = await ExecutionFence.claim({
        workflowsStore,
        leaseProvider: pubsub,
        agentId: 'agent',
        runId: 'run',
        mode: 'takeover',
      });
      const attached = child.run(() =>
        processor['getOrCreateAbortController'](
          'child',
          {
            [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: parent.claim, child: child.claim },
          },
          parentWorkflow,
        ),
      );
      expect(attached).not.toBe(original);
      await cancel(coordinator.generation!);
      await vi.waitFor(() => expect(rootController.signal.aborted).toBe(true));
      expect(attached.signal.aborted).toBe(false);
      expect(() => child.run(() => processor['getOrCreateAbortController']('child', context, parentWorkflow))).toThrow(
        expect.objectContaining({ id: EXECUTION_SUPERSEDED_ERROR_ID }),
      );
      await cancel(parent.generation!);
      await vi.waitFor(() => expect(attached.signal.aborted).toBe(true));
      // A stale root controller must not hide an eligible descendant on this replica.
      expect(rootController.signal.aborted).toBe(true);
    } finally {
      release();
    }
  },
);

it('does not announce snapshot cleanup when takeover rejects the canceled-end deletion', async () => {
  const { mastra, workflowsStore, pubsub, coordinator, event } = await createExecution();
  const processor = new WorkflowEventProcessor({ mastra });
  const workflow = createWorkflow({ id: event.data.workflowId, inputSchema: z.any(), outputSchema: z.any() }).commit();
  await coordinator.settle(async () => true);
  const remove = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
  const deletion = vi.spyOn(workflowsStore, 'deleteWorkflowRunById').mockImplementationOnce(async args => {
    await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode: 'takeover',
    });
    return remove(args);
  });
  const published = vi.spyOn(pubsub, 'publish');
  const end = {
    ...event,
    type: 'workflow.end',
    data: { ...event.data, prevResult: { status: 'canceled' }, deleteSnapshotAfterEnd: true },
  };
  try {
    await expect(
      participateInDurableExecution(mastra, end, () =>
        processor['processWorkflowEnd']({
          ...end.data,
          workflow,
          runId: 'run',
          executionPath: [],
          activeStepsPath: {},
          stepResults: {},
          resumeSteps: [],
        }),
      ),
    ).rejects.toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
    expect(deletion).toHaveBeenCalled();
    expect(published.mock.calls.some(([, delivery]) => delivery.type === 'workflow.finish-cleanup-complete')).toBe(
      false,
    );
  } finally {
    deletion.mockRestore();
    published.mockRestore();
  }
});

it('preserves a successor registration when canceled-end publication races a takeover', async () => {
  const { mastra, workflowsStore, pubsub, coordinator, event } = await createExecution();
  const processor = new WorkflowEventProcessor({ mastra });
  const workflow = createWorkflow({ id: event.data.workflowId, inputSchema: z.any(), outputSchema: z.any() }).commit();
  const successorWorkflow = createWorkflow({
    id: event.data.workflowId,
    inputSchema: z.any(),
    outputSchema: z.any(),
  }).commit();
  mastra.__registerInternalWorkflow(workflow, 'run');
  await coordinator.settle(async () => true);
  const publish = pubsub.publish.bind(pubsub);
  const published = vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, delivery) => {
    if (topic === 'workflows-finish' && delivery.type === 'workflow.end') {
      await ExecutionFence.claim({
        workflowsStore,
        leaseProvider: pubsub,
        agentId: 'agent',
        runId: 'run',
        mode: 'takeover',
      });
      mastra.__registerInternalWorkflow(successorWorkflow, 'run');
    }
    return publish(topic, delivery);
  });
  const end = { ...event, type: 'workflow.end', data: { ...event.data, prevResult: { status: 'canceled' } } };
  try {
    await expect(
      participateInDurableExecution(mastra, end, () =>
        processor['processWorkflowEnd']({
          ...end.data,
          workflow,
          runId: 'run',
          executionPath: [],
          activeStepsPath: {},
          stepResults: {},
          resumeSteps: [],
        }),
      ),
    ).rejects.toMatchObject({ id: RUN_FENCE_CONFLICT_ERROR_ID });
    expect(mastra.__getInternalWorkflow(event.data.workflowId, 'run')).toBe(successorWorkflow);
  } finally {
    published.mockRestore();
  }
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
