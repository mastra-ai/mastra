import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';
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
import { EventedExecutionEngine } from '../../workflows/evented/execution-engine';
import { WorkflowEventProcessor } from '../../workflows/evented/workflow-event-processor';
import { Agent } from '../agent';
import { AGENT_LEASE_RENEW_INTERVAL_MS, AGENT_LEASE_TTL_MS } from '../run-ownership';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { DurableStepIds } from './constants';
import { createEventedAgent } from './create-evented-agent';
import {
  participateInDurableExecution,
  retrySettledDurableExecution,
  settleEventedDurableExecution,
  stopAbandonedDurableExecution,
  stopDurableExecutionParticipants,
} from './evented-execution';
import { EventedExecutionEngine as DurableEventedExecutionEngine } from './evented-execution-engine';
import {
  __resetExecutionFencesForTests,
  assertExecutionNotSuperseded,
  DURABLE_PARTICIPANT_FENCES,
  DurableExecutionFenceError,
  EXECUTION_LEASE_RENEW_INTERVAL_MS,
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

it.each([false, true])(
  'leaves a rejected shared observer claim live for workers (unverified: %s)',
  async unverified => {
    const storage = new InMemoryStore();
    const mastra = new Mastra({ storage, logger: false });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const fence = await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: new EventEmitterPubSub(),
      agentId: 'agent',
      runId: 'observer-run',
      mode: 'acquire',
    });
    const engine = new DurableEventedExecutionEngine('agent', mastra);
    const error = unverified
      ? new DurableExecutionFenceError(EXECUTION_UNVERIFIED_ERROR_ID, {
          agentId: 'agent',
          runId: fence.runId,
          executionId: fence.executionId,
        })
      : new Error('observer connection closed');
    try {
      const outcome = engine.finishExecution(fence.runId, fence, true, { error });
      expect(outcome).toEqual(unverified ? { owner: 'workers', error } : { owner: 'workers' });
      expect(await workflowsStore.getRunOwnership({ runId: fence.runId })).toMatchObject({
        live: true,
        ownerId: fence.executionId,
        generation: fence.generation,
      });
      // A detached API observer must not be able to release its worker's claim later.
      let finalized = false;
      await fence.settle(async () => {
        finalized = true;
      });
      expect(finalized).toBe(false);
      expect(await workflowsStore.getRunOwnership({ runId: fence.runId })).toMatchObject({ live: true });
    } finally {
      fence.stopHeartbeat();
      await mastra.shutdown();
    }
  },
);

it('settles a failed evented setup after claiming the thread lease without starting workers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-setup-fail-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'bus.sock'));
  const storage = new InMemoryStore();
  const workflows = (await storage.getStore('workflows'))!;
  const { model } = deliveryModel('must not run');
  const memory = new MockMemory({ storage });
  const agent = createEventedAgent({
    agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Answer.', model, memory }),
    pubsub,
  });
  const mastra = new Mastra({ agents: { agent }, storage, pubsub, workers: false, logger: false });
  const workflow = agent.getWorkflow();
  let leaseOwner: string | undefined;
  const failure = new Error('run creation failed after leasing the thread');
  const createRun = vi.spyOn(workflow, 'createRun').mockImplementation(async () => {
    leaseOwner = await pubsub.getLeaseOwner('resource\u0000thread');
    throw failure;
  });
  try {
    const { runId, output, cleanup } = await agent.stream('Answer.', {
      runId: 'setup-failure-run',
      memory: { resource: 'resource', thread: 'thread' },
    });
    try {
      const errors = [];
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'error') errors.push(chunk.payload.error);
      }
      expect(errors).toEqual([expect.objectContaining({ message: failure.message })]);
      expect(leaseOwner).toContain('mastra:thread-lease:');
      await expect.poll(async () => (await workflows.getRunOwnership({ runId }))?.live).toBe(false);
      expect(await workflows.loadWorkflowRunStatus({ workflowName: DurableStepIds.AGENTIC_LOOP, runId })).toBeNull();
      await expect.poll(() => pubsub.getLeaseOwner('resource\u0000thread')).toBeUndefined();
    } finally {
      await cleanup();
    }
  } finally {
    createRun.mockRestore();
    await mastra.shutdown();
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
});

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

/**
 * An EventedAgent run on a real Unix socket transport whose first model call waits until `releaseModel()`, then asks
 * for approval of a `lookup` tool call. Resolves once the first model call started. With storage fencing the run is a
 * shared execution, and the worker renews the claim through a participant fence.
 */
async function startSuspendingSharedRun(args: { pubsub: UnixSocketPubSub; storage: InMemoryStore }) {
  const entered = Promise.withResolvers<void>();
  const firstCall = Promise.withResolvers<void>();
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      const call = ++calls;
      if (call === 1) {
        entered.resolve();
        await firstCall.promise;
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
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
      };
    },
  });
  const execute = vi.fn(async () => ({ found: true }));
  const lookup = createTool({
    id: 'lookup',
    description: 'Look something up',
    inputSchema: z.object({}),
    requireApproval: true,
    execute,
  });
  const agent = createEventedAgent({
    agent: new Agent({ id: 'agent', name: 'agent', instructions: 'Answer.', model, tools: { lookup } }),
    pubsub: args.pubsub,
  });
  const mastra = new Mastra({ agents: { agent }, storage: args.storage, pubsub: args.pubsub, logger: false });
  onTestFinished(async () => {
    firstCall.resolve();
    await mastra.shutdown();
  });

  const started = await agent.stream('Look it up', { requireToolApproval: true });
  const { runId } = started;
  const streamed = drainStream(started.fullStream);
  streamed.catch(() => {});
  await entered.promise;
  const coordinator = ExecutionFence.getLocalActive(runId)!;
  const participant = mastra.__getRunScope(runId)?.get(DURABLE_PARTICIPANT_FENCES)?.get(coordinator.executionId);
  const lost = vi.fn();
  coordinator.onLost(lost);
  participant?.onLost(lost);
  const sharedExecution = getRunRegistryEntry(runId, mastra)?.eventedExecution === true;
  return {
    agent,
    runId,
    coordinator,
    participant,
    sharedExecution,
    lost,
    execute,
    /** The first stream's chunks, once it closes. */
    streamed,
    releaseModel: () => firstCall.resolve(),
  };
}

/** Resume an approval-suspended run and return its chunks, failing if the stream has not finished within 5s. */
async function resumeToFinish(agent: Awaited<ReturnType<typeof startSuspendingSharedRun>>['agent'], runId: string) {
  const resumed = await agent.resume(runId, { approved: true });
  const chunks = await Promise.race([
    drainStream(resumed.fullStream),
    new Promise<'still open'>(resolve => setTimeout(() => resolve('still open'), 5_000)),
  ]);
  if (chunks === 'still open') throw new Error('the resumed stream was still open after 5s');
  return chunks;
}

/** A Unix socket transport in a fresh directory, removed after the test. */
async function socketPubSub(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  onTestFinished(async () => {
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  });
  return pubsub;
}

// A lease renewal sent just before the run suspends reaches storage after the worker released the claim. Nobody took
// the run over, so neither the API's coordinator nor the worker's participant may be marked lost, and the run resumes
// to its finish. (#30206)
it('resumes a shared EventedAgent run whose renewal reaches storage after the worker released the suspension (#30206)', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const pubsub = await socketPubSub('mastra-late-renewal-');
  const storage = new InMemoryStore();
  const workflows = (await storage.getStore('workflows'))!;

  // Hold every renewal the heartbeats send while the model call is pending, until the suspension released the claim.
  const renew = workflows.renewRunOwnership.bind(workflows);
  const renewal = Promise.withResolvers<void>();
  onTestFinished(() => renewal.resolve());
  let holding = false;
  const held: Array<Promise<boolean>> = [];
  vi.spyOn(workflows, 'renewRunOwnership').mockImplementation(args => {
    if (!holding) return renew(args);
    const result = renewal.promise.then(() => renew(args));
    held.push(result.then(({ renewed }) => renewed));
    return result;
  });
  const run = await startSuspendingSharedRun({ pubsub, storage });
  const { runId, coordinator, participant, lost } = run;
  expect(run.sharedExecution).toBe(true);
  expect(participant).toBeDefined();

  holding = true;
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  holding = false;
  expect(held.length).toBeGreaterThanOrEqual(2);
  run.releaseModel();
  await vi.waitFor(
    async () =>
      expect(await workflows.getRunOwnership({ runId })).toMatchObject({
        ownerId: coordinator.executionId,
        generation: coordinator.generation,
        leaseExpiresAt: null,
      }),
    { timeout: 5_000 },
  );
  await coordinator.whenSettled;

  renewal.resolve();
  expect(await Promise.all(held)).not.toContain(true);
  await new Promise(resolve => setImmediate(resolve));
  expect(lost).not.toHaveBeenCalled();
  expect(coordinator.isLost()).toBe(false);
  expect(participant?.isLost()).toBe(false);

  const chunks = await resumeToFinish(run.agent, runId);
  expect(chunks.map(chunk => chunk.type)).toContain('finish');
  expect(JSON.stringify(chunks)).toContain('resumed answer');
  expect(run.execute).toHaveBeenCalledTimes(1);
}, 20_000);

async function drainStream(stream: ReadableStream<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

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
    // Step writes on storage v1, then storage v2.
    const resultsSpies = (
      ['updateWorkflowResults', 'appendWorkflowRunEntries', 'mergeWorkflowRunStepResult'] as const
    ).map(method => {
      const write = (workflows[method] as (args: { runId: string; fence?: RunFence }) => Promise<unknown>).bind(
        workflows,
      );
      return vi.spyOn(workflows, method).mockImplementation((args: { runId: string; fence?: RunFence }) => {
        const current = delivery.getStore();
        if (current?.deliveryRunId === args.runId) {
          writes.push({ ...current, fence: resolveRunFence(workflows, args.fence, args.runId) });
        }
        return write(args) as never;
      });
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
      for (const spy of resultsSpies) spy.mockRestore();
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

/** The participant fence a delivery of `event` left renewing the shared claim in this process. */
async function heldParticipantRenewal(execution: Awaited<ReturnType<typeof createExecution>>) {
  const { workflowsStore, mastra, coordinator, event } = execution;
  await participateInDurableExecution(mastra, event, async () => {});
  const participant = mastra.__getRunScope('run')!.get(DURABLE_PARTICIPANT_FENCES)!.get(coordinator.executionId)!;
  const lost = vi.fn();
  participant.onLost(lost);
  const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
  let deliver!: () => void;
  const delivery = new Promise<void>(resolve => (deliver = resolve));
  let sent!: () => void;
  const renewalSent = new Promise<void>(resolve => (sent = resolve));
  let renewed: boolean | undefined;
  vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
    sent();
    await delivery;
    const result = await renew(args);
    renewed = result.renewed;
    return result;
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  await renewalSent;
  return { participant, lost, deliver, renewed: () => renewed };
}

// The worker that settles a shared run releases the claim its participant is still renewing. (#30206)
it('does not mark a participant lost when its renewal reaches storage after the worker released the suspended run (#30206)', async () => {
  vi.useFakeTimers();
  const execution = await createExecution();
  const { workflowsStore, mastra, coordinator, event } = execution;
  const { participant, lost, deliver, renewed } = await heldParticipantRenewal(execution);

  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.suspend' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
  deliver();
  await vi.advanceTimersByTimeAsync(0);

  expect(renewed()).toBe(false);
  expect(participant.isLost()).toBe(false);
  expect(lost).not.toHaveBeenCalled();
});

/**
 * Another process sharing only `storage` and `pubsub` with this one: a fresh module registry, so no execution state
 * kept in module memory crosses over.
 */
async function otherProcess(storage: NonNullable<ReturnType<Mastra['getStorage']>>, pubsub: EventEmitterPubSub) {
  vi.resetModules();
  const fences = await import('./execution-fence');
  const evented = await import('./evented-execution');
  const { Mastra: OtherMastra } = await import('../../mastra');
  expect(fences.ExecutionFence).not.toBe(ExecutionFence);
  const mastra = new OtherMastra({ storage, pubsub, logger: false });
  onTestFinished(async () => {
    await evented.stopDurableExecutionParticipants(mastra);
    fences.__resetExecutionFencesForTests();
  });
  return { mastra, fences, evented };
}

// The API process's coordinator and the worker settling the run live in different processes that share storage. The
// worker's release only shows in the ownership record, which still names the coordinator's claim. (#30206)
it('does not mark a coordinator lost when a worker in another process released the suspended run before its renewal landed (#30206)', async () => {
  vi.useFakeTimers();
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  instances.push(mastra);
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  onTestFinished(() => coordinator.stopHeartbeat());
  const lost = vi.fn();
  coordinator.onLost(lost);
  const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
  const delivery = Promise.withResolvers<void>();
  const renewals: boolean[] = [];
  vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
    if (renewals.length === 0) await delivery.promise;
    const result = await renew(args);
    renewals.push(result.renewed);
    return result;
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

  const worker = await otherProcess(storage, pubsub);
  const suspension: Event = {
    id: 'suspend',
    type: 'workflow.suspend',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: 'durable-agentic-loop',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim } },
    },
  };
  await worker.evented.settleEventedDurableExecution(worker.mastra, suspension);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
  delivery.resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(renewals).toEqual([false]);
  expect(coordinator.isLost()).toBe(false);
  expect(lost).not.toHaveBeenCalled();

  // A release that nothing settles, such as an abandoned terminal, must still reach a coordinator that keeps waiting:
  // its next renewal finds the claim still released and reports the loss.
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(renewals).toEqual([false, false]);
  expect(coordinator.isLost()).toBe(true);
});

// Documented limit: across processes the release only shows in the ownership record, and the next claim overwrites it.
// A renewal that reaches storage after another execution has claimed the run sees a newer generation and counts as a
// takeover, even though this run's own release came first. (#30206)
it('marks a coordinator lost when its renewal lands after a remote release and a new claim of the run (#30206)', async () => {
  vi.useFakeTimers();
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  instances.push(mastra);
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  onTestFinished(() => coordinator.stopHeartbeat());
  const lost = vi.fn();
  coordinator.onLost(lost);
  const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
  const delivery = Promise.withResolvers<void>();
  const renewals: boolean[] = [];
  vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
    if (renewals.length === 0) await delivery.promise;
    const result = await renew(args);
    renewals.push(result.renewed);
    return result;
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

  const worker = await otherProcess(storage, pubsub);
  const suspension: Event = {
    id: 'suspend',
    type: 'workflow.suspend',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: 'durable-agentic-loop',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim } },
    },
  };
  await worker.evented.settleEventedDurableExecution(worker.mastra, suspension);
  const next = await worker.fences.ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  onTestFinished(() => next.stopHeartbeat());
  expect(next.generation).toBeGreaterThan(coordinator.generation);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: next.executionId,
    generation: next.generation,
    live: true,
  });
  delivery.resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(renewals).toEqual([false]);
  expect(coordinator.isLost()).toBe(true);
  expect(lost).toHaveBeenCalledTimes(1);
});

// The documented limit with a real resume(): the API process holds the suspended run's coordinator and makes the new
// claim by resuming the run, and a worker in another process settled the suspension. The coordinator's held renewal
// then lands after the resume's claim, sees a newer generation and marks the suspended run lost. This pins what the
// resumed stream does then. (#30206)
it('streams a resumed EventedAgent run to its finish when the suspended run is marked lost after the resume claimed it (#30206)', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const directory = await mkdtemp(join(tmpdir(), 'mastra-limit-resume-'));
  const socket = join(directory, 'pubsub.sock');
  const storage = new InMemoryStore();
  const workflows = (await storage.getStore('workflows'))!;

  // Hold every renewal the heartbeats send while the first model call is pending.
  const renew = workflows.renewRunOwnership.bind(workflows);
  const renewal = Promise.withResolvers<void>();
  let holding = false;
  const held: Array<Promise<boolean>> = [];
  vi.spyOn(workflows, 'renewRunOwnership').mockImplementation(args => {
    if (!holding) return renew(args);
    const result = renewal.promise.then(() => renew(args));
    held.push(result.then(({ renewed }) => renewed));
    return result;
  });

  // The first call asks to run `lookup`. The resumed call waits until the suspended run was marked lost.
  const entered = Promise.withResolvers<void>();
  const firstCall = Promise.withResolvers<void>();
  const resumedCall = Promise.withResolvers<void>();
  let calls = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      const call = ++calls;
      if (call === 1) {
        entered.resolve();
        await firstCall.promise;
      } else {
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
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
      };
    },
  });
  const execute = vi.fn(async () => ({ found: true }));
  const lookupConfig = {
    id: 'lookup',
    description: 'Look something up',
    inputSchema: z.object({}),
    requireApproval: true,
    execute,
  };

  // The API process: this module registry. It runs no workers.
  const apiPubsub = new UnixSocketPubSub(socket);
  const apiAgent = createEventedAgent({
    agent: new Agent({
      id: 'agent',
      name: 'agent',
      instructions: 'Answer.',
      model,
      tools: { lookup: createTool(lookupConfig) },
    }),
    pubsub: apiPubsub,
  });
  const api = new Mastra({ agents: { agent: apiAgent }, storage, pubsub: apiPubsub, workers: false, logger: false });

  // The worker process: a fresh module registry, sharing only storage and the socket.
  vi.resetModules();
  const workerFences = await import('./execution-fence');
  expect(workerFences.ExecutionFence).not.toBe(ExecutionFence);
  const { createEventedAgent: createWorkerAgent } = await import('./create-evented-agent');
  const { Agent: WorkerAgent } = await import('../agent');
  const { Mastra: WorkerMastra } = await import('../../mastra');
  const { createTool: createWorkerTool } = await import('../../tools');
  const { UnixSocketPubSub: WorkerPubSub } = await import('../../events/unix-socket-pubsub');
  const workerPubsub = new WorkerPubSub(socket);
  const worker = new WorkerMastra({
    agents: {
      agent: createWorkerAgent({
        agent: new WorkerAgent({
          id: 'agent',
          name: 'agent',
          instructions: 'Answer.',
          model,
          tools: { lookup: createWorkerTool(lookupConfig) },
        }),
        pubsub: workerPubsub,
      }),
    },
    storage,
    pubsub: workerPubsub,
    logger: false,
  });
  onTestFinished(async () => {
    renewal.resolve();
    firstCall.resolve();
    resumedCall.resolve();
    await api.shutdown();
    await worker.shutdown();
    workerFences.__resetExecutionFencesForTests();
    await apiPubsub.close();
    await workerPubsub.close();
    await rm(directory, { recursive: true, force: true });
  });
  await worker.startWorkers();

  const started = await apiAgent.stream('Look it up', { requireToolApproval: true });
  const { runId } = started;
  void drainStream(started.fullStream);
  await entered.promise;
  const coordinator = ExecutionFence.getLocalActive(runId)!;
  expect(coordinator).toBeDefined();
  const lost = vi.fn();
  coordinator.onLost(lost);

  holding = true;
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  holding = false;
  expect(held.length).toBeGreaterThanOrEqual(1);
  firstCall.resolve();
  await vi.waitFor(
    async () =>
      expect(await workflows.getRunOwnership({ runId })).toMatchObject({
        ownerId: coordinator.executionId,
        generation: coordinator.generation,
        leaseExpiresAt: null,
      }),
    { timeout: 5_000 },
  );
  await coordinator.whenSettled;

  // The resume claims the run before the coordinator's renewal lands.
  const resumed = await apiAgent.resume(runId, { approved: true });
  const claimed = await workflows.getRunOwnership({ runId });
  expect(claimed?.generation).toBeGreaterThan(coordinator.generation!);
  expect(claimed?.live).toBe(true);
  renewal.resolve();
  expect(await Promise.all(held)).not.toContain(true);
  await vi.waitFor(() => expect(coordinator.isLost()).toBe(true));
  expect(lost).toHaveBeenCalledTimes(1);

  resumedCall.resolve();
  const chunks = await Promise.race([
    drainStream(resumed.fullStream),
    new Promise<'still open'>(resolve => setTimeout(() => resolve('still open'), 5_000)),
  ]);
  if (chunks === 'still open') throw new Error('the resumed stream was still open after 5s');
  expect(chunks.map(chunk => chunk.type)).toContain('finish');
  expect(JSON.stringify(chunks)).toContain('resumed answer');
  expect(execute).toHaveBeenCalledTimes(1);
}, 30_000);

// An abandoned release in this process is known at once: nothing will settle the run, so the coordinator's first failed
// renewal after it reports the loss, as before #30206, without the grace a release made elsewhere gets. (#30206)
it('marks a coordinator lost on its first failed renewal after this process abandoned the run (#30206)', async () => {
  vi.useFakeTimers();
  const storage = new InMemoryStore();
  const workflowsStore = (await storage.getStore('workflows'))!;
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  instances.push(mastra);
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  onTestFinished(() => coordinator.stopHeartbeat());
  const lost = vi.fn();
  coordinator.onLost(lost);
  const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
  const renewals: boolean[] = [];
  vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
    const result = await renew(args);
    renewals.push(result.renewed);
    return result;
  });
  const terminal: Event = {
    id: 'abandoned-fail',
    type: 'workflow.fail',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: 'durable-agentic-loop',
      runId: 'run',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim } },
    },
  };

  await stopAbandonedDurableExecution(mastra, terminal, false);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);

  expect(renewals).toEqual([false]);
  expect(coordinator.isLost()).toBe(true);
  expect(lost).toHaveBeenCalledTimes(1);
});

// The worker in this process publishes the run's suspension, then releases the claim. If the suspension never reaches
// the coordinator (the broker accepted it but never delivered it), the coordinator must still stop waiting: its first
// failed renewal after the release gets one interval of grace, as a release seen from another process does, and the
// next one reports the loss, so the caller's stream ends with an error instead of staying open. (#30206)
it('ends the stream with an error when the suspension of a shared EventedAgent run never reaches its coordinator (#30206)', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const pubsub = await socketPubSub('mastra-undelivered-finish-');
  const storage = new InMemoryStore();
  const workflows = (await storage.getStore('workflows'))!;
  const run = await startSuspendingSharedRun({ pubsub, storage });
  const { runId, coordinator } = run;
  expect(run.sharedExecution).toBe(true);
  const publish = pubsub.publish.bind(pubsub);
  const undelivered: string[] = [];
  vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
    if (topic === 'workflows-finish' && event.runId === runId) {
      undelivered.push(event.type);
      return;
    }
    return publish(topic, event);
  });

  run.releaseModel();
  await vi.waitFor(
    async () =>
      expect(await workflows.getRunOwnership({ runId })).toMatchObject({
        ownerId: coordinator.executionId,
        generation: coordinator.generation,
        leaseExpiresAt: null,
      }),
    { timeout: 5_000 },
  );
  expect(undelivered).toContain('workflow.suspend');

  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(coordinator.isLost()).toBe(false);
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(coordinator.isLost()).toBe(true);

  // The caller hears of the loss a renewal interval after it, on a real timer.
  const chunks = await Promise.race([
    run.streamed,
    new Promise<'still open'>(resolve =>
      setTimeout(() => resolve('still open'), 2 * EXECUTION_LEASE_RENEW_INTERVAL_MS),
    ),
  ]);
  expect(chunks).not.toBe('still open');
  expect(chunks === 'still open' ? undefined : chunks.at(-1)?.type).toBe('error');
}, 30_000);

// Two workers in one process share a run. Settling it in one worker does not tear down the other worker's participant.
// If that participant is still running, its first failed renewal after the release gets the same grace, and the next
// one marks it lost, so its publishes are dropped from then on. (#30206)
it('marks a participant in another worker of this process lost once it outlives the release of the run (#30206)', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createExecution();
  const other = new Mastra({ storage: mastra.getStorage()!, pubsub, logger: false });
  instances.push(other);
  await participateInDurableExecution(other, event, async () => {});
  const participant = other.__getRunScope('run')!.get(DURABLE_PARTICIPANT_FENCES)!.get(coordinator.executionId)!;
  const lost = vi.fn();
  participant.onLost(lost);
  const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
  const renewals: boolean[] = [];
  vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementation(async args => {
    const result = await renew(args);
    renewals.push(result.renewed);
    return result;
  });

  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.suspend' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(renewals).toEqual([false]);
  expect(participant.isLost()).toBe(false);

  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  expect(renewals).toEqual([false, false]);
  expect(participant.isLost()).toBe(true);
  expect(lost).toHaveBeenCalledTimes(1);
});

// Two workers share a run: the one settling the suspension releases the claim that a participant in the other worker
// is still renewing. (#30206)
it('does not mark a participant in another worker lost when this worker released the suspended run before its renewal landed (#30206)', async () => {
  vi.useFakeTimers();
  const { workflowsStore, pubsub, mastra, coordinator, event } = await createExecution();
  const other = await otherProcess(mastra.getStorage()!, pubsub);
  await other.evented.participateInDurableExecution(other.mastra, event, async () => {});
  const participant = other.mastra
    .__getRunScope('run')!
    .get(other.fences.DURABLE_PARTICIPANT_FENCES)!
    .get(coordinator.executionId)!;
  const lost = vi.fn();
  participant.onLost(lost);
  const renew = workflowsStore.renewRunOwnership.bind(workflowsStore);
  const delivery = Promise.withResolvers<void>();
  const sent = Promise.withResolvers<void>();
  let renewed: boolean | undefined;
  vi.spyOn(workflowsStore, 'renewRunOwnership').mockImplementationOnce(async args => {
    sent.resolve();
    await delivery.promise;
    const result = await renew(args);
    renewed = result.renewed;
    return result;
  });
  await vi.advanceTimersByTimeAsync(EXECUTION_LEASE_RENEW_INTERVAL_MS);
  await sent.promise;

  await settleEventedDurableExecution(mastra, { ...event, type: 'workflow.suspend' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
  delivery.resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(renewed).toBe(false);
  expect(participant.isLost()).toBe(false);
  expect(lost).not.toHaveBeenCalled();
});

it('still marks a participant lost when a takeover rejected its renewal before the worker released the claim (#30206)', async () => {
  vi.useFakeTimers();
  const execution = await createExecution();
  const { workflowsStore, pubsub, mastra, coordinator } = execution;
  const { participant, lost, deliver, renewed } = await heldParticipantRenewal(execution);
  const successor = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'takeover',
  });

  // The release is fenced to the captured claim, so it leaves the successor's claim alone and reports it.
  await ExecutionFence.releaseSharedClaim(mastra, 'run', coordinator.claim, 'settled');
  deliver();
  await vi.advanceTimersByTimeAsync(0);

  expect(renewed()).toBe(false);
  expect(participant.isLost()).toBe(true);
  expect(lost).toHaveBeenCalledTimes(1);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: successor.executionId,
    live: true,
  });
  successor.stopHeartbeat();
});

async function seedRunningRows(workflowsStore: Awaited<ReturnType<typeof createExecution>>['workflowsStore']) {
  for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
    await workflowsStore.persistWorkflowSnapshot({
      workflowName,
      runId: 'run',
      snapshot: { runId: 'run', status: 'running', value: {}, context: {} } as any,
    });
  }
}

async function storedRows(workflowsStore: Awaited<ReturnType<typeof createExecution>>['workflowsStore']) {
  const rows: string[] = [];
  for (const workflowName of [DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]) {
    if (await workflowsStore.getWorkflowRunById({ runId: 'run', workflowName })) rows.push(workflowName);
  }
  return rows;
}

it('rejects terminal cleanup when a takeover lands between the ownership check and the snapshot delete', async () => {
  const { workflowsStore, pubsub, mastra, event } = await createExecution();
  await seedRunningRows(workflowsStore);
  const remove = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
  let successor: ExecutionFence | undefined;
  const deletion = vi.spyOn(workflowsStore, 'deleteWorkflowRunById').mockImplementationOnce(async args => {
    successor = await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode: 'takeover',
    });
    successor.stopHeartbeat();
    return remove(args);
  });

  await expect(settleEventedDurableExecution(mastra, { ...event, type: 'workflow.end' })).rejects.toMatchObject({
    id: RUN_FENCE_CONFLICT_ERROR_ID,
  });

  expect(deletion).toHaveBeenCalledTimes(1);
  expect(await storedRows(workflowsStore)).toEqual([DurableStepIds.AGENTIC_LOOP, DurableStepIds.AGENTIC_EXECUTION]);
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: successor?.executionId,
    generation: successor?.generation,
    live: true,
  });
});

it('keeps the claim when a terminal snapshot delete fails partway, and clears both rows on redelivery', async () => {
  const { workflowsStore, mastra, event, coordinator } = await createExecution();
  await seedRunningRows(workflowsStore);
  const terminal = { ...event, type: 'workflow.end' };
  const remove = workflowsStore.deleteWorkflowRunById.bind(workflowsStore);
  const deletion = vi
    .spyOn(workflowsStore, 'deleteWorkflowRunById')
    .mockImplementationOnce(remove)
    .mockRejectedValueOnce(new Error('storage unavailable'));

  await expect(settleEventedDurableExecution(mastra, terminal)).rejects.toThrow('storage unavailable');

  expect(await storedRows(workflowsStore)).toEqual([DurableStepIds.AGENTIC_EXECUTION]);
  const ownership = await workflowsStore.getRunOwnership({ runId: 'run' });
  expect(ownership).toMatchObject({ ownerId: coordinator.executionId, generation: coordinator.generation });
  expect(ownership?.leaseExpiresAt).not.toBeNull();
  expect(await retrySettledDurableExecution(mastra, terminal)).toBe(false);

  deletion.mockRestore();
  await settleEventedDurableExecution(mastra, terminal);
  expect(await storedRows(workflowsStore)).toEqual([]);
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

it('carries the execution claim on a cancel sent before the first step finishes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-cancel-first-step-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  const storage = new InMemoryStore();
  const workflow = createWorkflow({ id: 'durable-agentic-loop', inputSchema: z.object({}), outputSchema: z.object({}) })
    .then(
      createStep({
        id: 'llm',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async ({ abortSignal }) => {
          await new Promise(resolve => abortSignal.addEventListener('abort', resolve, { once: true }));
          return {};
        },
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
    runId: 'first-step-run',
    mode: 'acquire',
  });
  const requestContext = new RequestContext([[MASTRA_DURABLE_EXECUTIONS_KEY, { 'first-step-run': coordinator.claim }]]);
  const published = vi.spyOn(pubsub, 'publish');
  try {
    const run = await workflow.createRun({ runId: 'first-step-run' });
    const persist = workflows.persistWorkflowSnapshot.bind(workflows);
    let canceled: Promise<void> | undefined;
    vi.spyOn(workflows, 'persistWorkflowSnapshot').mockImplementation(async args => {
      await persist(args);
      // Cancel in the window between the processor's running snapshot and the first step result.
      if (args.runId === run.runId && 'guardedOnlySnapshot' in args.snapshot) canceled ??= run.cancel();
    });
    await mastra.startWorkers();
    const result = run.start({ inputData: {}, requestContext });
    await vi.waitFor(() => expect(canceled).toBeDefined());
    await canceled;
    const cancel = published.mock.calls.find(
      ([topic, event]) => topic === 'workflows' && event.type === 'workflow.cancel',
    );
    expect(cancel?.[1].data?.requestContext).toMatchObject({
      [MASTRA_DURABLE_EXECUTIONS_KEY]: { 'first-step-run': coordinator.claim },
    });
    await result;
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

// Worker B ran the tool-call step; worker A handled the terminal event and released the shared claim. B's
// participant fence stays registered until its heartbeat notices, and a background task's late write on B
// was checked strictly against it, so it failed as superseded though nobody took the run. (#30182)
it("accepts a late background write on one worker after another worker released the run's claim", async () => {
  const { workflowsStore, pubsub, mastra: workerA, coordinator, event } = await createExecution();
  const workerB = new Mastra({ storage: workerA.getStorage(), pubsub });
  instances.push(workerB);
  await participateInDurableExecution(workerA, event, async () => {});
  await participateInDurableExecution(workerB, event, async () => {});
  const participantB = workerB.__getRunScope('run')!.get(DURABLE_PARTICIPANT_FENCES)!.get(coordinator.executionId)!;

  await settleEventedDurableExecution(workerA, { ...event, type: 'workflow.end' });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
    ownerId: coordinator.executionId,
    generation: coordinator.generation,
    leaseExpiresAt: null,
  });
  const late = { runId: 'run', agentId: 'agent', mastra: workerB };
  const requestContext = new RequestContext(Object.entries(event.data.requestContext));
  await expect(assertExecutionNotSuperseded({ ...late, requestContext })).resolves.toBeUndefined();
  expect(participantB.isLost()).toBe(false);

  // Once another execution claims the run, the late write on B is refused.
  const successor = await workflowsStore.claimRunOwnership({
    runId: 'run',
    ownerId: 'successor',
    leaseMs: 60_000,
    expectedGeneration: coordinator.generation,
  });
  expect(successor.acquired).toBe(true);
  await expect(assertExecutionNotSuperseded({ ...late, requestContext })).rejects.toMatchObject({
    id: EXECUTION_SUPERSEDED_ERROR_ID,
  });
});

it('refuses a late background write on one worker once a successor claimed the run another worker released', async () => {
  const { workflowsStore, pubsub, mastra: workerA, coordinator, event } = await createExecution();
  const workerB = new Mastra({ storage: workerA.getStorage(), pubsub });
  instances.push(workerB);
  await participateInDurableExecution(workerA, event, async () => {});
  await participateInDurableExecution(workerB, event, async () => {});

  await settleEventedDurableExecution(workerA, { ...event, type: 'workflow.end' });
  await workflowsStore.claimRunOwnership({
    runId: 'run',
    ownerId: 'successor',
    leaseMs: 60_000,
    expectedGeneration: coordinator.generation,
  });
  const requestContext = new RequestContext(Object.entries(event.data.requestContext));
  await expect(
    assertExecutionNotSuperseded({ runId: 'run', agentId: 'agent', requestContext, mastra: workerB }),
  ).rejects.toMatchObject({ id: EXECUTION_SUPERSEDED_ERROR_ID });
  expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({ ownerId: 'successor', live: true });
});

it('stops renewing the claim when the processor abandons a root terminal delivery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-abandoned-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  const workflowsStore = (await storage.getStore('workflows'))!;
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  coordinator.stopHeartbeat();
  const terminal: Event = {
    id: 'abandoned-terminal',
    type: 'workflow.end',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: 'durable-agentic-loop',
      runId: 'run',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim } },
    },
  };
  const processor = new WorkflowEventProcessor({ mastra });
  vi.spyOn(processor, 'loadData').mockRejectedValue(
    Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' }),
  );
  const renewals = vi.spyOn(workflowsStore, 'renewRunOwnership');
  try {
    expect(await processor.handle(terminal)).toEqual({ ok: false, retry: true });
    expect(await processor.handle(terminal)).toEqual({ ok: false, retry: true });
    await vi.waitFor(() => expect(renewals).toHaveBeenCalled(), { timeout: EXECUTION_LEASE_TTL_MS * 2 });
    expect(await processor.handle(terminal)).toEqual({ ok: false, retry: false });
    const renewed = renewals.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, EXECUTION_LEASE_TTL_MS * 1.5));
    expect(renewals).toHaveBeenCalledTimes(renewed);
    expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
      ownerId: coordinator.executionId,
      live: false,
    });
  } finally {
    renewals.mockRestore();
    await stopDurableExecutionParticipants(mastra);
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('releases the claim so a live coordinator sees the loss when the processor abandons a workflow.fail delivery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-abandoned-fail-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  const workflowsStore = (await storage.getStore('workflows'))!;
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  const terminal: Event = {
    id: 'abandoned-fail',
    type: 'workflow.fail',
    runId: 'run',
    createdAt: new Date(),
    data: {
      workflowId: 'durable-agentic-loop',
      runId: 'run',
      requestContext: { [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: coordinator.claim } },
    },
  };
  const processor = new WorkflowEventProcessor({ mastra });
  vi.spyOn(processor, 'loadData').mockRejectedValue(
    Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' }),
  );
  try {
    expect(await processor.handle(terminal)).toEqual({ ok: false, retry: true });
    expect(await processor.handle(terminal)).toEqual({ ok: false, retry: true });
    expect(coordinator.isLost()).toBe(false);
    expect(await processor.handle(terminal)).toEqual({ ok: false, retry: false });
    expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
      ownerId: coordinator.executionId,
      generation: coordinator.generation,
      leaseExpiresAt: null,
      live: false,
    });
    await vi.waitFor(() => expect(coordinator.isLost()).toBe(true), { timeout: EXECUTION_LEASE_TTL_MS * 2 });
  } finally {
    coordinator.stopHeartbeat();
    await stopDurableExecutionParticipants(mastra);
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it.each(['exhausted', 'healthy'] as const)(
  'settles the claim and thread lease of an abandoned root terminal whose compensating publication is %s',
  async publication => {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-abandoned-unpublished-'));
    const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
    const storage = new InMemoryStore();
    const mastra = new Mastra({ storage, pubsub, logger: false });
    const workflowsStore = (await storage.getStore('workflows'))!;
    const coordinator = await ExecutionFence.claim({
      workflowsStore,
      leaseProvider: pubsub,
      agentId: 'agent',
      runId: 'run',
      mode: 'acquire',
    });
    coordinator.stopHeartbeat();
    const threadKey = 'resource\u0000thread';
    await agentThreadStreamRuntime.claimDurableThreadLease(pubsub, 'run', 'thread', 'resource', coordinator.generation);
    const requestContext = {
      [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: { ...coordinator.claim, threadId: 'thread', resourceId: 'resource' } },
    };
    const terminal: Event = {
      id: `abandoned-${publication}`,
      type: 'workflow.end',
      runId: 'run',
      createdAt: new Date(),
      data: { workflowId: 'durable-agentic-loop', runId: 'run', requestContext },
    };
    const processor = new WorkflowEventProcessor({ mastra });
    vi.spyOn(processor, 'loadData').mockRejectedValue(
      Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' }),
    );
    const errorWorkflow = vi.spyOn(processor, 'errorWorkflow');
    if (publication === 'exhausted') errorWorkflow.mockRejectedValue(new Error('publish failed (test)'));
    else errorWorkflow.mockResolvedValue(undefined);
    const renewLease = vi.spyOn(pubsub, 'renewLease');
    try {
      const results = [];
      for (let delivery = 0; delivery < 6; delivery++) {
        const result = await processor.handle(terminal);
        results.push(result.retry);
        if (!result.retry) break;
      }
      expect(results).toEqual(publication === 'exhausted' ? [true, true, true, true, false] : [true, true, false]);

      if (publication === 'healthy') {
        // The published workflow.fail settles the run, so abandonment must leave the claim and lease to it.
        expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
          ownerId: coordinator.executionId,
          leaseExpiresAt: expect.any(Date),
        });
        expect(await pubsub.getLeaseOwner(threadKey)).toBeDefined();
        await settleEventedDurableExecution(mastra, { ...terminal, id: 'published-fail', type: 'workflow.fail' });
      }

      expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
        ownerId: coordinator.executionId,
        generation: coordinator.generation,
        leaseExpiresAt: null,
        live: false,
      });
      expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined();
      renewLease.mockClear();
      await new Promise(resolve => setTimeout(resolve, AGENT_LEASE_RENEW_INTERVAL_MS + 1_000));
      expect(renewLease.mock.calls.filter(([key]) => key === threadKey)).toEqual([]);
      expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined();
      expect(await pubsub.acquireLease(threadKey, 'next-run', AGENT_LEASE_TTL_MS)).toMatchObject({ acquired: true });
    } finally {
      renewLease.mockRestore();
      await stopDurableExecutionParticipants(mastra);
      await pubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

it('releases an abandoned unpublished terminal on a serialized redelivery after its first release failed', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mastra-abandoned-redelivery-'));
  const pubsub = new UnixSocketPubSub(join(directory, 'pubsub.sock'));
  const storage = new InMemoryStore();
  const mastra = new Mastra({ storage, pubsub, logger: false });
  const workflowsStore = (await storage.getStore('workflows'))!;
  const coordinator = await ExecutionFence.claim({
    workflowsStore,
    leaseProvider: pubsub,
    agentId: 'agent',
    runId: 'run',
    mode: 'acquire',
  });
  coordinator.stopHeartbeat();
  const threadKey = 'resource\u0000thread';
  await agentThreadStreamRuntime.claimDurableThreadLease(pubsub, 'run', 'thread', 'resource', coordinator.generation);
  const requestContext = {
    [MASTRA_DURABLE_EXECUTIONS_KEY]: { run: { ...coordinator.claim, threadId: 'thread', resourceId: 'resource' } },
  };
  const terminal: Event = {
    id: 'abandoned-redelivered',
    type: 'workflow.end',
    runId: 'run',
    createdAt: new Date(),
    data: { workflowId: 'durable-agentic-loop', runId: 'run', requestContext },
  };
  const processor = new WorkflowEventProcessor({ mastra });
  vi.spyOn(processor, 'loadData').mockRejectedValue(
    Object.assign(new Error('SQLITE_BUSY: database is locked (test)'), { code: 'SQLITE_BUSY' }),
  );
  vi.spyOn(processor, 'errorWorkflow').mockRejectedValue(new Error('publish failed (test)'));
  const releaseSharedClaim = vi
    .spyOn(ExecutionFence, 'releaseSharedClaim')
    .mockRejectedValueOnce(new Error('release failed (test)'));
  // Each delivery is a fresh object, as a transport that serializes events hands it over.
  const redeliver = () => processor.handle(JSON.parse(JSON.stringify(terminal)));
  try {
    const results = [];
    for (let delivery = 0; delivery < 6; delivery++) results.push((await redeliver()).retry);
    // The abandoning delivery fails its release and asks for a retry; the next one finds the event terminal.
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(releaseSharedClaim).toHaveBeenCalledTimes(2);
    expect(await workflowsStore.getRunOwnership({ runId: 'run' })).toMatchObject({
      ownerId: coordinator.executionId,
      generation: coordinator.generation,
      leaseExpiresAt: null,
      live: false,
    });
    expect(await pubsub.getLeaseOwner(threadKey)).toBeUndefined();
  } finally {
    releaseSharedClaim.mockRestore();
    await stopDurableExecutionParticipants(mastra);
    await pubsub.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it.each(['released', 'taken over', 'released while unsubscribe fails'] as const)(
  'stops a shared caller waiting on a run whose claim was %s, without writing to the run',
  async loss => {
    const released = loss !== 'taken over';
    const directory = await mkdtemp(join(tmpdir(), 'mastra-caller-loss-'));
    const socket = join(directory, 'pubsub.sock');
    const storage = new InMemoryStore();
    const workflows = (await storage.getStore('workflows'))!;
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
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
    const execute = vi.spyOn(EventedExecutionEngine.prototype, 'execute');
    const unsubscribe = vi.spyOn(apiPubsub, 'unsubscribe');
    // A failed unsubscribe must still reject the caller with the loss, not surface as an unhandled rejection.
    if (loss === 'released while unsubscribe fails') {
      unsubscribe.mockRejectedValueOnce(new Error('publisher queue full (test)'));
    }
    let successor: ExecutionFence | undefined;
    try {
      await worker.startWorkers();
      const output = await apiAgent.stream('Answer the question.', {
        runId: `caller-loss-${loss.replaceAll(' ', '-')}`,
        memory: { resource: 'resource', thread: 'thread' },
      });
      const { runId } = output;
      const streamEnd = (async () => {
        let last: { type: string; message?: string } | undefined;
        for await (const chunk of output.fullStream) {
          last = {
            type: chunk.type,
            ...(chunk.type === 'error' ? { message: (chunk.payload.error as Error)?.message } : {}),
          };
        }
        return last;
      })().catch(() => undefined);
      await entered.promise;
      const started = execute.mock.results[0]!.value as Promise<unknown>;
      const outcome = started.then(
        () => ({ settled: 'resolved' as const }),
        (error: { id?: string }) => ({ settled: 'rejected' as const, id: error?.id }),
      );
      const claimed = (await workflows.getRunOwnership({ runId }))!;

      if (released) {
        await workflows.releaseRunOwnership({ runId, generation: claimed.generation, ownerId: claimed.ownerId });
      } else {
        successor = await ExecutionFence.claim({
          workflowsStore: workflows,
          leaseProvider: workerPubsub,
          agentId: 'agent',
          runId,
          mode: 'takeover',
        });
        successor.stopHeartbeat();
      }
      const ownership = await workflows.getRunOwnership({ runId });
      const loopRow = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      const threadOwner = await workerPubsub.getLeaseOwner(threadKey);
      const publish = vi.spyOn(apiPubsub, 'publish');

      expect(await outcome).toEqual({
        settled: 'rejected',
        id: released ? EXECUTION_UNVERIFIED_ERROR_ID : EXECUTION_SUPERSEDED_ERROR_ID,
      });
      expect(unsubscribe.mock.calls.some(([topic]) => topic === 'workflows-finish')).toBe(true);
      expect(publish.mock.calls.filter(([topic]) => topic === 'workflows' || topic === 'workflows-finish')).toEqual([]);
      expect(await workflows.getRunOwnership({ runId })).toEqual(ownership);
      expect(await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP })).toEqual(loopRow);
      // Nobody else will publish to a released run's stream, so the caller's stream must end with the loss.
      if (released) {
        expect(await streamEnd).toEqual({
          type: 'error',
          message: expect.stringContaining('could not verify that this execution still owns the run'),
        });
      }
      if (loss === 'taken over') {
        expect(ownership).toMatchObject({ ownerId: successor!.executionId, generation: successor!.generation });
        expect(await workerPubsub.getLeaseOwner(threadKey)).toBe(threadOwner);
      }
    } finally {
      execute.mockRestore();
      release.resolve();
      successor?.stopHeartbeat();
      await api.shutdown();
      await worker.shutdown();
      await apiPubsub.close();
      await workerPubsub.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
  40_000,
);
