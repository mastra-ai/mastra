/**
 * A durable agent's background task can write to memory after the run that dispatched it has
 * finished and released its claim: the task's suspension (it asks for input) or its result. The
 * write passes an ownership check while nobody has claimed the run, but can reach storage after a
 * successor claimed the run and raised the memory fence. These cases run that ordering on a real
 * LibSQL file, with workflows and memory in the same store, and check that the late write carries
 * the finished run's claim to the memory domain object the adapter fences, so LibSQL's write
 * transaction rejects it. With nobody taking over, the late suspension parks the task and a resume
 * completes it on the same database. (#30182)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import type { MastraDBMessage } from '@mastra/core/memory';
import { RUN_FENCE_CONFLICT_ERROR_ID } from '@mastra/core/storage';
import type { MemoryStorage, RunFence } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { LibSQLStore } from '../storage';
import { gate } from './cross-process/step-agent';

const TOOL_CALL_ID = 'call-bg-1';
const ACK = 'Waiting for the analyst.';

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.restoreAllMocks();
});

async function waitFor<T>(read: () => Promise<T>, ok: (value: T) => boolean, label: string): Promise<T> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const value = await read();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

function stream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

// Calls the background tool on the first turn, then acknowledges. Any later turn (a wake to
// report the task) acknowledges too.
function scriptedModel() {
  return new MastraLanguageModelV2Mock({
    doStream: async ({ prompt }) => {
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp', modelId: 'mock-model-id', timestamp: new Date(0) },
      ];
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const sawToolResult = prompt.some(message => message.role === 'tool');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        stream: stream(
          sawToolResult
            ? [
                ...head,
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: ACK },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ]
            : [
                ...head,
                {
                  type: 'tool-call',
                  toolCallId: TOOL_CALL_ID,
                  toolName: 'research',
                  input: JSON.stringify({ topic: 'near' }),
                  providerExecuted: false,
                },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ],
        ),
      };
    },
  });
}

/** Holds the next `saveMessages` on `memoryStore` until `finish()`, and reports how it ended. */
function holdNextSave(memoryStore: MemoryStorage) {
  const started = gate();
  const release = gate();
  const outcome = gate<unknown>();
  const saveMessages = memoryStore.saveMessages.bind(memoryStore);
  vi.spyOn(memoryStore, 'saveMessages').mockImplementationOnce(async args => {
    started.resolve();
    await release.promise;
    try {
      const saved = await saveMessages(args);
      outcome.resolve(undefined);
      return saved;
    } catch (error) {
      outcome.resolve(error);
      throw error;
    }
  });
  cleanups.push(async () => release.resolve());
  return { started: started.promise, finish: () => release.resolve(), outcome: outcome.promise };
}

function toolCallIn(messages: MastraDBMessage[]) {
  for (const message of messages) {
    for (const part of message.content.parts ?? []) {
      if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === TOOL_CALL_ID) {
        const suspendedTools = message.content.metadata?.suspendedTools;
        const suspended =
          suspendedTools && typeof suspendedTools === 'object' && TOOL_CALL_ID in suspendedTools
            ? (suspendedTools as Record<string, unknown>)[TOOL_CALL_ID]
            : undefined;
        return { invocation: part.toolInvocation, suspended };
      }
    }
  }
  return undefined;
}

async function startDeferredResearch(engine: 'durable' | 'evented', outcome: 'suspend' | 'result') {
  const dir = await mkdtemp(join(tmpdir(), 'mastra-30182-libsql-'));
  const storage = new LibSQLStore({ id: `late-write-${engine}-${outcome}`, url: `file:${join(dir, 'mastra.db')}` });
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  // Memory on the same LibSQL file as the run's claim, as a deployment configures it.
  const memory = new MockMemory();
  memory.setStorage(storage);
  const memoryStore = (await memory.storage.getStore('memory'))!;
  // The object the late write's claim fence is keyed to is the one LibSQL's memory domain checks.
  expect(memoryStore).toBe(await storage.getStore('memory'));

  // The finished run retires its memory fence last; the takeover waits for that.
  const cleanedUp = gate();
  const retireRunFence = memoryStore.retireRunFence.bind(memoryStore);
  vi.spyOn(memoryStore, 'retireRunFence').mockImplementation(async (fence: RunFence) => {
    try {
      return await retireRunFence(fence);
    } finally {
      cleanedUp.resolve();
    }
  });

  const toolGate = gate();
  const research = createTool({
    id: 'research',
    description: 'Research a topic after analyst approval',
    inputSchema: z.object({ topic: z.string() }),
    outputSchema: z.object({ summary: z.string() }),
    background: { enabled: true },
    execute: async ({ topic }, options) => {
      const resumeData = options?.agent?.resumeData as { notes?: string } | undefined;
      if (resumeData) return { summary: `Research on "${topic}": ${resumeData.notes}` };
      await toolGate.promise;
      if (outcome === 'result') return { summary: `Research on "${topic}"` };
      return options?.agent?.suspend?.({ awaiting: 'analyst-approval', topic }) as never;
    },
  });
  const agent = new Agent({
    id: `late-write-${engine}`,
    name: 'Late write agent',
    instructions: 'Research what the user asks.',
    model: scriptedModel(),
    tools: { research },
    memory,
    backgroundTasks: { tools: { research: true } },
  });
  const pubsub = new EventEmitterPubSub();
  const durable = engine === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent, pubsub });
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub,
    agents: { [durable.id]: durable },
    backgroundTasks: { enabled: true, globalConcurrency: 5, perAgentConcurrency: 3 },
  });
  await mastra.startWorkers();
  cleanups.push(async () => {
    await mastra.backgroundTaskManager?.shutdown();
    await mastra.stopWorkers();
  });

  const thread = { threadId: `late-write-${engine}-${outcome}`, resourceId: 'late-write-user' };
  const run = await durable.stream('Research near', {
    memory: { thread: thread.threadId, resource: thread.resourceId },
    maxSteps: 3,
  });
  let taskId: string | undefined;
  for await (const chunk of run.fullStream) {
    if (chunk.type === 'background-task-started') taskId = chunk.payload.taskId;
  }
  expect(await run.output.text).toBe(ACK);
  expect(taskId).toBeDefined();

  const workflows = (await storage.getStore('workflows'))!;
  // A released claim keeps its row with no lease, unlike one that merely lapsed.
  const released = await waitFor(
    () => workflows.getRunOwnership({ runId: run.runId }),
    record => record?.leaseExpiresAt === null,
    'the finished run to release its claim',
  );
  await cleanedUp.promise;

  const manager = mastra.backgroundTaskManager!;
  return {
    memoryStore,
    workflows,
    manager,
    taskId: taskId!,
    thread,
    runId: run.runId,
    released: released!,
    letToolGo: () => toolGate.resolve(),
    storedToolCall: async () => toolCallIn((await memoryStore.listMessages({ ...thread, perPage: false })).messages),
    settledTask: () =>
      waitFor(
        () => manager.getTask(taskId!),
        (task: BackgroundTask | null) => task?.status !== 'pending' && task?.status !== 'running',
        'the background task to settle',
      ),
  };
}

type Research = Awaited<ReturnType<typeof startDeferredResearch>>;

/** A successor claims the run and raises the memory fence, as recovery or a new turn does before it touches memory. */
async function takeOver(research: Research) {
  const successor = await research.workflows.claimRunOwnership({
    runId: research.runId,
    ownerId: 'successor-execution',
    leaseMs: 60_000,
    expectedGeneration: research.released.generation,
  });
  expect(successor.acquired).toBe(true);
  const fence = { runId: research.runId, generation: successor.record!.generation, ownerId: 'successor-execution' };
  expect(await research.memoryStore.raiseRunFence(fence)).toBe(true);
  return fence;
}

/** LibSQL refused the write because it carried the finished run's own claim, now replaced. */
function expectRejectedForFinishedClaim(error: unknown, research: Research) {
  expect(error).toMatchObject({
    id: RUN_FENCE_CONFLICT_ERROR_ID,
    details: {
      runId: research.runId,
      generation: research.released.generation,
      ownerId: research.released.ownerId,
      operation: 'saveMessages',
    },
  });
}

async function expectSuccessorUnchanged(research: Research, successor: RunFence) {
  const after = await research.workflows.getRunOwnership({ runId: research.runId });
  expect({ ownerId: after?.ownerId, generation: after?.generation, live: after?.live }).toEqual({
    ownerId: successor.ownerId,
    generation: successor.generation,
    live: true,
  });
}

describe.each(['durable', 'evented'] as const)(
  '%s agent on LibSQL: late background writes after the run finished',
  engine => {
    // Technical: the late suspension's save required the finished run to still own its claim,
    // which LibSQL showed as released, so the task failed with DURABLE_AGENT_EXECUTION_UNVERIFIED.
    // With nobody claiming the run since, the save now passes and storage accepts the claim. (#30182)
    it('parks a deferred tool that asks for input after its run finished, and resumes it (#30182)', async () => {
      const research = await startDeferredResearch(engine, 'suspend');
      research.letToolGo();

      const parked = await research.settledTask();
      expect({ status: parked?.status, error: parked?.error?.message }).toEqual({
        status: 'suspended',
        error: undefined,
      });
      expect(parked?.suspendPayload).toEqual({ awaiting: 'analyst-approval', topic: 'near' });
      const open = await research.storedToolCall();
      expect(open?.suspended).toMatchObject({
        taskId: research.taskId,
        suspendPayload: { awaiting: 'analyst-approval', topic: 'near' },
      });

      await research.manager.resume(research.taskId, { notes: 'looks promising' });
      const done = await waitFor(
        () => research.manager.getTask(research.taskId),
        (task: BackgroundTask | null) => task?.status === 'completed' || task?.status === 'failed',
        'the resumed task to finish',
      );
      expect({ status: done?.status, error: done?.error?.message, result: done?.result }).toEqual({
        status: 'completed',
        error: undefined,
        result: { summary: 'Research on "near": looks promising' },
      });
      // The thread on LibSQL holds the answered tool call, with the open request cleared.
      const answered = await waitFor(
        () => research.storedToolCall(),
        stored => stored?.invocation.state === 'result' && stored.suspended === undefined,
        'the tool result in memory',
      );
      expect(answered?.invocation).toMatchObject({
        state: 'result',
        result: { summary: 'Research on "near": looks promising' },
      });
    }, 30_000);

    // Technical: the suspension's save passed `assertExecutionNotSuperseded` with no successor yet,
    // then reached LibSQL after a successor claimed the run and raised the memory fence.
    // `runFencedToClaim` gives the save the finished run's claim, and the write transaction rejects it. (#30182)
    it("doesn't park a deferred tool whose suspension reaches the database after another execution took over (#30182)", async () => {
      const research = await startDeferredResearch(engine, 'suspend');
      const save = holdNextSave(research.memoryStore);
      research.letToolGo();
      await save.started;
      const successor = await takeOver(research);
      save.finish();

      expectRejectedForFinishedClaim(await save.outcome, research);
      const task = await research.settledTask();
      expect({ status: task?.status, error: task?.error?.message }).toEqual({
        status: 'failed',
        error: expect.stringContaining("is no longer the run's current claim"),
      });
      expect(task?.suspendPayload).toBeUndefined();
      const stored = await research.storedToolCall();
      expect(stored?.invocation).toBeDefined();
      expect(stored?.suspended).toBeUndefined();
      await expectSuccessorUnchanged(research, successor);
    }, 30_000);

    // Technical: same ordering for the background task's result (`onResult` flush). (#30182)
    it("doesn't record a deferred tool's result that reaches the database after another execution took over (#30182)", async () => {
      const research = await startDeferredResearch(engine, 'result');
      const save = holdNextSave(research.memoryStore);
      research.letToolGo();
      await save.started;
      const successor = await takeOver(research);
      save.finish();

      expectRejectedForFinishedClaim(await save.outcome, research);
      // Memory keeps the dispatch placeholder, not the superseded execution's result.
      const stored = await research.storedToolCall();
      expect(stored?.invocation).toBeDefined();
      expect(JSON.stringify(stored?.invocation)).not.toContain('Research on');
      expect(stored?.suspended).toBeUndefined();
      await expectSuccessorUnchanged(research, successor);
    }, 30_000);
  },
);
