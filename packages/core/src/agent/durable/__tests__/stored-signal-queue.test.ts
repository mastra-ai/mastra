/**
 * Signals sent to a running evented agent whose memory storage keeps pending
 * signals: the sender stores them as pending rows of the thread, the run's
 * drain points claim them, and what a run never took becomes the thread's
 * next turn.
 */
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Memory } from '../../../../../memory/src';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import type { MastraMemory } from '../../../memory/memory';
import { MockMemory } from '../../../memory/mock';
import type { MastraDBMessage } from '../../../memory/types';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import type { PendingSignalEnqueueResult } from '../../../storage/domains/memory/base';
import { InMemoryMemory } from '../../../storage/domains/memory/inmemory';
import { createTool } from '../../../tools';
import { warnUnsharedAgentSignals } from '../../../workflows/evented/setup-warning';
import { Agent } from '../../agent';
import { createSignal } from '../../signals';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';
import { closeStoredSignalRun, storedSignalDrain } from '../stored-signal-drain';
import type { RunRegistryEntry } from '../types';

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => (release = resolve));
  return { promise, release };
}

type SignalsCall =
  | { op: 'enqueue'; id: string; toRunId?: string }
  | { op: 'claim'; runId: string; ids: string[] }
  | { op: 'close'; runId: string; consumedIds: string[] };

/**
 * The in-memory memory storage, recording every pending-signal call that
 * reached it, in order. The hooks let a test hold a call, run a send at a
 * chosen drain point, or make a call fail after its write, as a store that
 * drops its connection mid-call does.
 */
class ObservedMemory extends InMemoryMemory {
  readonly calls: SignalsCall[] = [];
  /** Runs before each insert reaches the store. */
  beforeEnqueue?: (message: MastraDBMessage) => Promise<void>;
  /** The next insert fails before writing. */
  failNextEnqueue = false;
  /** Runs before each claim reaches the store. */
  beforeClaim?: (args: { runId: string }) => Promise<void>;
  /** The next claim that returns this id fails after claiming, as a claim whose answer was lost does. */
  failClaimOf?: string;
  /** Runs before each marker write, as preparation makes before the run starts. */
  beforeSetSignalRun?: () => Promise<void>;

  constructor() {
    super({ db: new InMemoryDB() });
  }

  override async enqueuePendingSignal(args: {
    message: MastraDBMessage;
    toRunId?: string;
  }): Promise<PendingSignalEnqueueResult> {
    await this.beforeEnqueue?.(args.message);
    if (this.failNextEnqueue) {
      this.failNextEnqueue = false;
      throw new Error('memory storage unavailable');
    }
    this.calls.push({ op: 'enqueue', id: args.message.id, ...(args.toRunId ? { toRunId: args.toRunId } : {}) });
    return super.enqueuePendingSignal(args);
  }

  override async claimPendingSignals(args: { threadId: string; runId: string; consumedIds: string[] }) {
    await this.beforeClaim?.(args);
    const rows = await super.claimPendingSignals(args);
    this.calls.push({ op: 'claim', runId: args.runId, ids: rows.map(row => row.id) });
    if (this.failClaimOf && rows.some(row => row.id === this.failClaimOf)) {
      this.failClaimOf = undefined;
      throw new Error('memory storage unavailable');
    }
    return rows;
  }

  override async closeSignalRun(args: { threadId: string; runId: string; consumedIds: string[] }) {
    this.calls.push({ op: 'close', runId: args.runId, consumedIds: args.consumedIds });
    return super.closeSignalRun(args);
  }

  override async setSignalRun(args: { threadId: string; runId: string }) {
    await this.beforeSetSignalRun?.();
    return super.setSignalRun(args);
  }

  claimsOf(id: string) {
    return this.calls.filter(
      (call): call is Extract<SignalsCall, { op: 'claim' }> => call.op === 'claim' && call.ids.includes(id),
    );
  }

  /** Claims of `runId`, counted from 1 in the order they reach the store. */
  claimsBy(runId: string) {
    return this.calls.filter(call => call.op === 'claim' && call.runId === runId).length;
  }
}

/** The recording memory storage, reporting itself shared by every process, as Postgres and a LibSQL file are. */
class SharedObservedMemory extends ObservedMemory {
  override get pendingSignalsSharedAcrossProcesses(): boolean {
    return true;
  }
}

/** Memory storage that keeps no pending signals, as stores other than Postgres, LibSQL and in-memory. */
class NoPendingSignalsMemory extends InMemoryMemory {
  override readonly supportsPendingSignals = false;

  constructor() {
    super({ db: new InMemoryDB() });
  }
}

/** A pubsub whose first release of a thread's lease waits for the test, as a slow lease provider's does. */
class HeldReleasePubSub extends EventEmitterPubSub {
  /** The thread whose lease release is held. */
  holdReleaseOf?: string;
  readonly releaseReached = gate();
  readonly releaseHeld = gate();
  #held = false;

  override async releaseLease(key: string, owner: string): Promise<void> {
    if (!this.#held && this.holdReleaseOf && key.includes(this.holdReleaseOf)) {
      this.#held = true;
      this.releaseReached.release();
      await this.releaseHeld.promise;
    }
    return super.releaseLease(key, owner);
  }
}

/** Waits until the run a wake started has ended. */
async function wakeEnded(accepted: { action: string; output?: { getFullOutput: () => Promise<unknown> } }) {
  expect(accepted.action).toBe('wake');
  await accepted.output!.getFullOutput();
}

function textOf(prompt: unknown): string {
  return JSON.stringify(prompt);
}

/** How many times `text` occurs in a model prompt. */
function occurrences(prompt: unknown, text: string): number {
  return textOf(prompt).split(text).length - 1;
}

/** The signal chunks of a stream that carry `contents`. */
function signalChunksOf(chunks: Array<{ type: string }>, contents: string) {
  return chunks.filter(chunk => chunk.type.startsWith('data-') && JSON.stringify(chunk).includes(contents));
}

const BARRIER = 'BARRIER_QUEUED_AFTER_THE_RUN';

/** A total timeout no run reaches on its own: the test elapses it through {@link holdDeadline}. */
const HELD_DEADLINE_MS = 3_600_017;

/**
 * Holds the timer of a run's total timeout of {@link HELD_DEADLINE_MS}, the only timer with that delay, so the
 * deadline elapses exactly when the test says. Every other timer runs as usual.
 */
function holdDeadline() {
  const realSetTimeout = globalThis.setTimeout;
  let fire: (() => void) | undefined;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    handler: (...args: unknown[]) => void,
    ms?: number,
    ...args: unknown[]
  ) => {
    if (ms !== HELD_DEADLINE_MS) return realSetTimeout(handler, ms, ...args);
    const timer = realSetTimeout(() => {}, ms);
    fire = () => {
      clearTimeout(timer);
      handler(...args);
    };
    return timer;
  }) as typeof setTimeout);
  return {
    elapse: () => {
      if (!fire) throw new Error('the run armed no total timeout');
      fire();
    },
  };
}

/**
 * An evented agent with memory whose first model call asks for a tool that
 * waits for the test; later calls answer with text. Every prompt is recorded.
 */
function setup({
  memoryStore = new ObservedMemory(),
  withMemory = true,
  park = false,
  hangingCall,
  stopWhen,
  totalMs,
  inputProcessors,
  pubsub = new EventEmitterPubSub(),
  createMemory = storage => new MockMemory({ storage }),
}: {
  memoryStore?: InMemoryMemory;
  /** Give the agent no memory at all. */
  withMemory?: boolean;
  /** The agent's memory over the test's storage. */
  createMemory?: (storage: InMemoryStore) => MastraMemory;
  /** The model call after the tool asks for a tool that needs approval, so the run parks there. */
  park?: boolean;
  /** This model call streams nothing and ends only when its request is aborted. */
  hangingCall?: number;
  stopWhen?: () => boolean;
  /** The run's total deadline. */
  totalMs?: number;
  inputProcessors?: Processor[];
  pubsub?: EventEmitterPubSub;
} = {}) {
  const prompts: unknown[] = [];
  const promptWaiters: Array<{ count: number; reached: () => void }> = [];
  const promptsReached = (count: number) =>
    new Promise<void>(resolve => {
      if (prompts.length >= count) resolve();
      else promptWaiters.push({ count, reached: resolve });
    });
  const toolGate = gate();
  const toolReached = gate();
  const barrierReached = gate();
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt, abortSignal }) => {
      prompts.push(prompt);
      const call = prompts.length;
      for (const waiter of promptWaiters) if (waiter.count <= call) waiter.reached();
      if (textOf(prompt).includes(BARRIER)) barrierReached.release();
      if (call === hangingCall) {
        return {
          warnings: [],
          stream: new ReadableStream<LanguageModelV2StreamPart>({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              abortSignal?.addEventListener('abort', () => controller.error(abortSignal.reason), { once: true });
            },
          }),
        };
      }
      const toolName = call === 1 ? 'wait' : call === 2 && park ? 'confirm' : undefined;
      return {
        warnings: [],
        stream: convertArrayToReadableStream(
          toolName
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: `call-${toolName}`, toolName, input: '{}' },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: `text-${call}` },
                { type: 'text-delta', id: `text-${call}`, delta: `answer ${call}` },
                { type: 'text-end', id: `text-${call}` },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ],
        ),
      };
    },
  });
  const wait = createTool({
    id: 'wait',
    description: 'Waits for the test',
    inputSchema: z.object({}),
    execute: async () => {
      toolReached.release();
      await toolGate.promise;
      return 'waited';
    },
  });
  const confirm = createTool({
    id: 'confirm',
    description: 'Needs the user to approve it',
    inputSchema: z.object({}),
    requireApproval: true,
    execute: async () => 'confirmed',
  });
  const storage = new InMemoryStore();
  storage.stores.memory = memoryStore;
  const memory = createMemory(storage);
  const agent = createEventedAgent({
    agent: new Agent({
      id: 'stored-signals',
      name: 'stored-signals',
      instructions: 'Test',
      model,
      ...(withMemory ? { memory } : {}),
      tools: { wait, confirm },
      ...(inputProcessors ? { inputProcessors } : {}),
    }),
    pubsub,
  });
  const mastra = new Mastra({ agents: { owner: agent }, storage, pubsub, logger: false });
  const scope = { resourceId: `resource-${crypto.randomUUID()}`, threadId: `thread-${crypto.randomUUID()}` };
  /** Starts the run, without waiting for anything. */
  const begin = async (memoryOptions: { readOnly?: boolean } = {}) => {
    const stream = await agent.stream('Start', {
      memory: {
        thread: scope.threadId,
        resource: scope.resourceId,
        ...(memoryOptions.readOnly ? { options: { readOnly: true } } : {}),
      },
      maxSteps: 4,
      ...(stopWhen ? { stopWhen } : {}),
      ...(totalMs ? { modelSettings: { timeout: { totalMs } } } : {}),
    });
    const chunks: Array<{ type: string; payload?: any; data?: any }> = [];
    // Rejects when the run reports an error, so a test that expects none sees it.
    const done = (async () => {
      for await (const chunk of stream.fullStream) chunks.push(chunk as (typeof chunks)[number]);
      const error = chunks.find(chunk => chunk.type === 'error');
      if (error) throw error.payload?.error ?? new Error('the run reported an error');
    })();
    return { stream, done, chunks };
  };
  /** Starts the run and waits until its tool holds it. */
  const start = async (memoryOptions: { readOnly?: boolean } = {}) => {
    const started = await begin(memoryOptions);
    await toolReached.promise;
    return started;
  };
  /**
   * Queues a message behind the run and waits for its model call. Queued
   * messages start after every follow-up turn the run left, so once this
   * returns no follow-up turn of the run is still to come.
   */
  const afterFollowUps = async () => {
    const barrier = agent.queueMessage(BARRIER, scope);
    await barrier.accepted;
    return barrierReached.promise;
  };
  /** The thread's saved messages, as memory reads them. */
  const savedMessages = async () =>
    (await memoryStore.listMessages({ threadId: scope.threadId, perPage: false })).messages;
  return {
    agent,
    mastra,
    storage,
    memoryStore,
    scope,
    prompts,
    promptsReached,
    toolGate,
    begin,
    start,
    afterFollowUps,
    savedMessages,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signals of a running evented agent kept in memory storage', () => {
  it('delivers two sends made back to back to the next model call in send order', async () => {
    const memoryStore = new ObservedMemory();
    // The first insert is slow; the second send must still reach the store after it.
    const firstInsert = gate();
    let held = false;
    memoryStore.beforeEnqueue = async () => {
      if (held) return;
      held = true;
      await firstInsert.promise;
    };
    const { agent, scope, prompts, toolGate, start } = setup({ memoryStore });
    const { stream, done, chunks } = await start();
    const first = agent.sendSignal({ type: 'user', contents: 'FIRST_SEND' }, scope);
    const second = agent.sendSignal({ type: 'user', contents: 'SECOND_SEND' }, scope);
    firstInsert.release();
    await expect(first.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    await expect(second.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    expect(memoryStore.calls.filter(call => call.op === 'enqueue')).toEqual([
      { op: 'enqueue', id: first.signal.id, toRunId: stream.runId },
      { op: 'enqueue', id: second.signal.id, toRunId: stream.runId },
    ]);
    toolGate.release();
    await done;

    const afterTool = textOf(prompts[1]);
    expect(occurrences(prompts[1], 'FIRST_SEND')).toBe(1);
    expect(occurrences(prompts[1], 'SECOND_SEND')).toBe(1);
    expect(afterTool.indexOf('SECOND_SEND')).toBeGreaterThan(afterTool.indexOf('FIRST_SEND'));
    expect(prompts).toHaveLength(2);
    // Each drain after the one that took them skips them, so the stream shows each signal once.
    expect(signalChunksOf(chunks, 'FIRST_SEND')).toHaveLength(1);
    expect(signalChunksOf(chunks, 'SECOND_SEND')).toHaveLength(1);
  });

  it('does not report a failed insert as delivered, and the next send on the thread still arrives', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start } = setup();
    const { done } = await start();
    (memoryStore as ObservedMemory).failNextEnqueue = true;
    const failed = agent.sendSignal({ type: 'user', contents: 'LOST_SEND' }, scope);
    await expect(failed.accepted).rejects.toThrow('memory storage unavailable');
    const next = agent.sendSignal({ type: 'user', contents: 'LATER_SEND' }, scope);
    await expect(next.accepted).resolves.toMatchObject({ action: 'deliver' });
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'LATER_SEND')).toBe(1);
    expect(prompts.map(textOf).some(prompt => prompt.includes('LOST_SEND'))).toBe(false);
  });

  it('rejects a send to a run whose thread is gone from its memory storage, naming the thread', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start } = setup();
    const { done } = await start();
    await memoryStore.deleteThread({ threadId: scope.threadId });
    const sent = agent.sendSignal({ type: 'user', contents: 'NO_THREAD_SEND' }, scope);
    await expect(sent.accepted).rejects.toThrow(`Thread ${scope.threadId} of resource ${scope.resourceId}`);
    toolGate.release();
    await done.catch(() => {});

    expect(prompts.map(textOf).some(prompt => prompt.includes('NO_THREAD_SEND'))).toBe(false);
  });

  it('cancels a signal no drain took yet, resolves with its id, and never delivers it', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start, savedMessages } = setup();
    const { done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'CANCELLED_SEND' }, scope);
    await sent.accepted;
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([
      expect.objectContaining({ id: sent.signal.id }),
    ]);
    await expect(agent.cancelQueuedMessages({ ...scope, signalIds: [sent.signal.id] })).resolves.toEqual({
      cancelledSignalIds: [sent.signal.id],
    });
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
    toolGate.release();
    await done;

    expect(prompts.map(textOf).some(prompt => prompt.includes('CANCELLED_SEND'))).toBe(false);
    expect(prompts).toHaveLength(2);
    expect((await savedMessages()).some(message => message.id === sent.signal.id)).toBe(false);
  });

  it('keeps a signal sent right after a stop that clears the thread, and delivers it', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start, afterFollowUps } = setup();
    const { done } = await start();
    const cleared = agent.sendSignal({ type: 'user', contents: 'CLEARED_BY_THE_STOP' }, scope);
    await cleared.accepted;
    agent.abortThreadStream({ ...scope, clearPendingSignals: true });
    const later = agent.sendSignal({ type: 'user', contents: 'SENT_AFTER_THE_STOP' }, scope);
    await expect(later.accepted).resolves.toMatchObject({ action: 'deliver' });
    toolGate.release();
    await done.catch(() => {});
    await afterFollowUps();

    expect(prompts.map(textOf).some(prompt => prompt.includes('CLEARED_BY_THE_STOP'))).toBe(false);
    // The stopped run took nothing more; the thread's next run takes it with its first request.
    const delivered = prompts.filter(prompt => textOf(prompt).includes('SENT_AFTER_THE_STOP'));
    expect(delivered.length).toBeGreaterThan(0);
    expect(occurrences(delivered[0], 'SENT_AFTER_THE_STOP')).toBe(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });

  it('cancels nothing once a run claimed the signal, which reaches its transcript', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start } = setup();
    const { stream, done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'TAKEN_SEND' }, scope);
    await sent.accepted;
    // The run's next claim takes the row, as the drain after the tool does.
    await memoryStore.claimPendingSignals({ threadId: scope.threadId, runId: stream.runId, consumedIds: [] });
    await expect(agent.cancelQueuedMessages({ ...scope, signalIds: [sent.signal.id] })).resolves.toEqual({
      cancelledSignalIds: [],
    });
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'TAKEN_SEND')).toBe(1);
  });

  it('makes a send that finds the run closed the next turn in the process holding the run', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start, afterFollowUps } = setup();
    const { stream, done } = await start();
    // The executing process closed the run before this send was stored, as finalize does before FINISH.
    await memoryStore.closeSignalRun({ threadId: scope.threadId, runId: stream.runId, consumedIds: [] });
    const sent = agent.sendSignal({ type: 'user', contents: 'AFTER_CLOSE_SEND' }, scope);
    await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    await followUpsDone;

    expect(textOf(prompts[1])).not.toContain('AFTER_CLOSE_SEND');
    const followUps = prompts.slice(2).filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(followUps).toHaveLength(1);
    expect(occurrences(followUps[0], 'AFTER_CLOSE_SEND')).toBe(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });

  it('starts the next turn for a send that lands as the run ends, before the run gave its lease back', async () => {
    const memoryStore = new ObservedMemory();
    // The send's insert waits until the run ended and its own end-of-run check read the store.
    const firstInsert = gate();
    let held = false;
    memoryStore.beforeEnqueue = async () => {
      if (held) return;
      held = true;
      await firstInsert.promise;
    };
    const pubsub = new HeldReleasePubSub();
    const { agent, scope, prompts, promptsReached, toolGate, start, afterFollowUps } = setup({ memoryStore, pubsub });
    pubsub.holdReleaseOf = scope.threadId;
    const { stream, done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'LANDS_AS_THE_RUN_ENDS' }, scope);
    toolGate.release();
    await done;
    // The ended run's release of the thread lease has not landed.
    await pubsub.releaseReached.promise;
    firstInsert.release();
    await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    await promptsReached(3);
    pubsub.releaseHeld.release();
    await afterFollowUps();

    expect(occurrences(prompts[1], 'LANDS_AS_THE_RUN_ENDS')).toBe(0);
    expect(occurrences(prompts[2], 'LANDS_AS_THE_RUN_ENDS')).toBe(1);
    expect(prompts.slice(2).filter(prompt => !textOf(prompt).includes(BARRIER))).toHaveLength(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });

  it('delivers to the first model request a signal sent while stream() has reserved the thread', async () => {
    const memoryStore = new ObservedMemory();
    const { agent, scope, prompts, toolGate, begin } = setup({ memoryStore });
    // Preparation names the run on the thread right before the workflow starts; until then the run is only
    // reserved here.
    const reserved = gate();
    const named = gate();
    memoryStore.beforeSetSignalRun = async () => {
      memoryStore.beforeSetSignalRun = undefined;
      reserved.release();
      await named.promise;
    };
    const starting = begin();
    await reserved.promise;
    // Answered at once, as for a run that keeps its signals in memory; the signal waits in this process.
    const first = agent.sendSignal({ type: 'user', contents: 'FIRST_WHILE_RESERVED' }, scope);
    const second = agent.sendSignal({ type: 'user', contents: 'SECOND_WHILE_RESERVED' }, scope);
    await expect(first.accepted).resolves.toMatchObject({ action: 'deliver' });
    await expect(second.accepted).resolves.toMatchObject({ action: 'deliver' });
    expect(memoryStore.calls.filter(call => call.op === 'enqueue')).toEqual([]);
    named.release();
    const { stream, done, chunks } = await starting;
    toolGate.release();
    await done;

    // Moved into the store for the run before its first model request, in send order.
    expect(memoryStore.calls.filter(call => call.op === 'enqueue')).toEqual([
      { op: 'enqueue', id: first.signal.id, toRunId: stream.runId },
      { op: 'enqueue', id: second.signal.id, toRunId: stream.runId },
    ]);
    const firstRequest = textOf(prompts[0]);
    expect(occurrences(prompts[0], 'FIRST_WHILE_RESERVED')).toBe(1);
    expect(occurrences(prompts[0], 'SECOND_WHILE_RESERVED')).toBe(1);
    expect(firstRequest.indexOf('SECOND_WHILE_RESERVED')).toBeGreaterThan(firstRequest.indexOf('FIRST_WHILE_RESERVED'));
    expect(prompts.slice(1).some(prompt => occurrences(prompt, 'FIRST_WHILE_RESERVED') > 1)).toBe(false);
    expect(signalChunksOf(chunks, 'FIRST_WHILE_RESERVED')).toHaveLength(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });

  it('delivers to the first model request a signal that joined a wake before its run started', async () => {
    const memoryStore = new ObservedMemory();
    const { agent, scope, prompts, toolGate } = setup({ memoryStore });
    const wake = agent.sendSignal({ type: 'user', contents: 'WAKES_THE_THREAD' }, scope);
    const joined = agent.sendSignal({ type: 'user', contents: 'JOINS_THE_WAKE' }, scope);
    toolGate.release();
    const woken = await wake.accepted;
    expect(woken.action).toBe('wake');
    // Answered once its insert for the woken run committed.
    await expect(joined.accepted).resolves.toEqual({ action: 'deliver', runId: woken.runId });
    expect(memoryStore.calls.filter(call => call.op === 'enqueue')).toEqual([
      { op: 'enqueue', id: joined.signal.id, toRunId: woken.runId },
    ]);
    await wakeEnded(woken);

    expect(occurrences(prompts[0], 'WAKES_THE_THREAD')).toBe(1);
    expect(occurrences(prompts[0], 'JOINS_THE_WAKE')).toBe(1);
    expect(textOf(prompts[0]).indexOf('JOINS_THE_WAKE')).toBeGreaterThan(
      textOf(prompts[0]).indexOf('WAKES_THE_THREAD'),
    );
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });

  it('rejects a send that joined a wake when its insert for the woken run fails', async () => {
    const memoryStore = new ObservedMemory();
    const { agent, scope, prompts, toolGate } = setup({ memoryStore });
    memoryStore.failNextEnqueue = true;
    const wake = agent.sendSignal({ type: 'user', contents: 'WAKES_THE_THREAD' }, scope);
    const joined = agent.sendSignal({ type: 'user', contents: 'NEVER_STORED' }, scope);
    toolGate.release();
    const woken = await wake.accepted;
    await expect(joined.accepted).rejects.toThrow('memory storage unavailable');
    await wakeEnded(woken);

    expect(prompts.map(textOf).some(prompt => prompt.includes('NEVER_STORED'))).toBe(false);
  });

  it('cancels a send that joined a wake of an agent whose signals stay in memory', async () => {
    const { agent, scope, toolGate } = setup({ memoryStore: new NoPendingSignalsMemory() });
    const wake = agent.sendSignal({ type: 'user', contents: 'WAKES_THE_THREAD' }, scope);
    const joined = agent.sendSignal({ type: 'user', contents: 'CANCELLED_BEFORE_THE_RUN' }, scope);
    await expect(agent.cancelQueuedMessages({ ...scope, signalIds: [joined.signal.id] })).resolves.toEqual({
      cancelledSignalIds: [joined.signal.id],
    });
    toolGate.release();
    await wakeEnded(await wake.accepted);
  });

  it('leaves the thread to its active run when a run with read-only memory runs on it', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start, begin } = setup();
    const { stream, done } = await start();
    // A read-only run doesn't reserve the thread, so it runs beside the active run.
    const readOnly = await begin({ readOnly: true });
    expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).toBe(stream.runId);
    await readOnly.done;
    expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).toBe(stream.runId);
    const sent = agent.sendSignal({ type: 'user', contents: 'AFTER_READ_ONLY_RUN' }, scope);
    await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    toolGate.release();
    await done;

    // The read-only run's request is the second; the active run's request after its tool is the third.
    expect(prompts).toHaveLength(3);
    expect(occurrences(prompts[2], 'AFTER_READ_ONLY_RUN')).toBe(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });
});

describe('drains of a storage-backed run', () => {
  it("streams a signal the loop's continuation check takes once, and asks the model once for it", async () => {
    const memoryStore = new ObservedMemory();
    const { agent, scope, prompts, toolGate, start } = setup({ memoryStore });
    const { stream, done, chunks } = await start();
    // Sent right before the continuation check after the tool claims. The first claim is the first model
    // request's, the second the signal-drain step's.
    let sent: ReturnType<typeof agent.sendSignal> | undefined;
    memoryStore.beforeClaim = async ({ runId }) => {
      if (runId !== stream.runId || memoryStore.claimsBy(runId) !== 2) return;
      sent = agent.sendSignal({ type: 'user', contents: 'TAKEN_BY_THE_CHECK' }, scope);
      await sent.accepted;
    };
    toolGate.release();
    await done;

    expect(memoryStore.claimsOf(sent!.signal.id)).toHaveLength(1);
    expect(signalChunksOf(chunks, 'TAKEN_BY_THE_CHECK')).toHaveLength(1);
    expect(prompts).toHaveLength(2);
    expect(occurrences(prompts[1], 'TAKEN_BY_THE_CHECK')).toBe(1);
  });

  it('delivers a signal once when the claim that took it lost its answer', async () => {
    const memoryStore = new ObservedMemory();
    const { agent, scope, prompts, toolGate, start } = setup({ memoryStore });
    const { stream, done, chunks } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'CLAIM_ANSWER_LOST' }, scope);
    await sent.accepted;
    // The drain after the tool claims the row and then fails; the run's next claim returns it again.
    memoryStore.failClaimOf = sent.signal.id;
    toolGate.release();
    await done;

    expect(memoryStore.claimsOf(sent.signal.id).map(claim => claim.runId)).toEqual([stream.runId, stream.runId]);
    expect(prompts).toHaveLength(2);
    expect(occurrences(prompts[1], 'CLAIM_ANSWER_LOST')).toBe(1);
    expect(signalChunksOf(chunks, 'CLAIM_ANSWER_LOST')).toHaveLength(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
  });

  it('claims and closes on a worker whose first resolution of the memory storage failed', async () => {
    const memoryStore = new ObservedMemory();
    const { agent, mastra, storage, scope } = setup({ memoryStore });
    const runId = `worker-run-${crypto.randomUUID()}`;
    await memoryStore.saveThread({
      thread: {
        id: scope.threadId,
        resourceId: scope.resourceId,
        title: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await memoryStore.setSignalRun({ threadId: scope.threadId, runId });
    const signal = createSignal({ type: 'user', contents: 'WAITS_FOR_THE_WORKER' });
    await memoryStore.enqueuePendingSignal({
      message: signal.toDBMessage({ threadId: scope.threadId, resourceId: scope.resourceId }),
      toRunId: runId,
    });
    // A worker holds a registry entry for the run but none of the memory its starting process resolved.
    globalRunRegistry.set(runId, {} as RunRegistryEntry);
    const input = { signalsStored: true, agentId: agent.id, state: scope };
    const getStore = storage.getStore.bind(storage);
    let failed = false;
    vi.spyOn(storage, 'getStore').mockImplementation(async (...args: Parameters<typeof storage.getStore>) => {
      if (args[0] === 'memory' && !failed) {
        failed = true;
        throw new Error('memory storage unavailable');
      }
      return getStore(...args);
    });
    try {
      const getState = async () => ({});
      // The step whose resolution failed claims nothing; the next site resolves the store again.
      await expect(storedSignalDrain({ mastra, runId, input, getState })!()).resolves.toBeUndefined();
      const drained = await storedSignalDrain({ mastra, runId, input, getState })!();
      expect(drained?.signals.map(taken => taken.id)).toEqual([signal.id]);
      await closeStoredSignalRun({ mastra, runId, input, state: drained!.state });

      expect(failed).toBe(true);
      expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).toBeNull();
      expect(memoryStore.calls.filter(call => call.op === 'close')).toEqual([
        { op: 'close', runId, consumedIds: [signal.id] },
      ]);
    } finally {
      globalRunRegistry.delete(runId);
    }
  });

  it('skips a row it cannot read and delivers the signal next to it', async () => {
    const memoryStore = new ObservedMemory();
    const { agent, mastra, scope, prompts, toolGate, start } = setup({ memoryStore });
    const { stream, done } = await start();
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    // A row another release wrote in a shape this one can't turn back into a signal.
    const unreadable = {
      id: crypto.randomUUID(),
      threadId: scope.threadId,
      resourceId: scope.resourceId,
      role: 'signal',
      type: 'user',
      createdAt: new Date(),
    } as unknown as MastraDBMessage;
    await expect(memoryStore.enqueuePendingSignal({ message: unreadable, toRunId: stream.runId })).resolves.toBe(
      'accepted',
    );
    const sent = agent.sendSignal({ type: 'user', contents: 'READABLE_NEIGHBOR' }, scope);
    await sent.accepted;
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'READABLE_NEIGHBOR')).toBe(1);
    expect(memoryStore.claimsOf(unreadable.id).length).toBeGreaterThan(0);
    expect(warn).toHaveBeenCalledWith(
      'Skipped a stored agent signal this version cannot read',
      expect.objectContaining({ signalId: unreadable.id }),
    );
    // Never counted as consumed, so the close gives it back to the thread instead of deleting it.
    const closes = memoryStore.calls.filter(call => call.op === 'close');
    expect(closes.some(call => call.consumedIds.includes(unreadable.id))).toBe(false);
    expect(closes.some(call => call.consumedIds.includes(sent.signal.id))).toBe(true);
    expect((await memoryStore.listPendingSignals({ threadId: scope.threadId })).map(row => row.id)).toEqual([
      unreadable.id,
    ]);
  });

  it('saves a signal in history after the assistant message it was sent during', async () => {
    const { agent, scope, toolGate, start, savedMessages } = setup();
    const { done } = await start();
    // Sent while the tool of the first assistant message runs, so it joins the transcript after that message.
    const sent = agent.sendSignal({ type: 'user', contents: 'ORDERED_SEND' }, scope);
    await sent.accepted;
    toolGate.release();
    await done;

    const saved = await savedMessages();
    const signalAt = saved.findIndex(message => message.id === sent.signal.id);
    const toolCallAt = saved.findIndex(message => JSON.stringify(message.content).includes('call-wait'));
    const answerAt = saved.findIndex(message => JSON.stringify(message.content).includes('answer 2'));
    expect(signalAt).toBeGreaterThan(toolCallAt);
    expect(toolCallAt).toBeGreaterThanOrEqual(0);
    expect(answerAt).toBeGreaterThan(signalAt);
  });
});

/** A pubsub whose next publish that `refuseOnce` picks fails, as a broker that dropped its connection does. */
class RefusingPubSub extends EventEmitterPubSub {
  refuseOnce?: (topic: string, event: Omit<Event, 'id' | 'createdAt'>) => Promise<boolean>;

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (this.refuseOnce && (await this.refuseOnce(topic, event))) {
      this.refuseOnce = undefined;
      throw new Error('pubsub unavailable');
    }
    return super.publish(topic, event, options);
  }
}

/** An observer model for observational memory that always reports the same observation. */
function observerModel() {
  const text = '<observations>\n* The user started a job\n</observations>';
  const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      finishReason: 'stop',
      usage,
      warnings: [],
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      warnings: [],
      stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'observation' },
        { type: 'text-delta', id: 'observation', delta: text },
        { type: 'text-end', id: 'observation' },
        { type: 'finish', finishReason: 'stop', usage },
      ]),
    }),
  });
}

describe('a storage-backed run with observational memory', () => {
  it('delivers a signal once when the step that saved it to memory is delivered again', async () => {
    const memoryStore = new ObservedMemory();
    const pubsub = new RefusingPubSub();
    const { agent, scope, prompts, toolGate, start, savedMessages } = setup({
      memoryStore,
      pubsub,
      // Buffers observations at every model request, which saves the request's messages to memory inside the
      // step. The threshold is never reached, so no observation replaces a message in the model's context.
      createMemory: memoryStorage =>
        new Memory({
          storage: memoryStorage,
          options: {
            observationalMemory: {
              enabled: true,
              observation: { model: observerModel(), messageTokens: 100_000, bufferTokens: 1 },
              reflection: { model: observerModel(), observationTokens: 100_000 },
            },
          },
        }),
    });
    const { stream, done } = await start();
    // Sent right before the model request after the tool claims, so that step takes it: the first claim is the
    // first request's, then the signal-drain step's and the continuation check's.
    let sent: ReturnType<typeof agent.sendSignal> | undefined;
    memoryStore.beforeClaim = async ({ runId }) => {
      if (runId !== stream.runId || memoryStore.claimsBy(runId) !== 3) return;
      sent = agent.sendSignal({ type: 'user', contents: 'SAVED_BEFORE_THE_STATE' }, scope);
      await sent.accepted;
    };
    // The end of the model request after the tool, which carries that step's state, fails to publish once, so
    // the step is delivered again. When it fails, memory already holds the signal as a message.
    let refused: { visible: boolean } | undefined;
    pubsub.refuseOnce = async (topic, event) => {
      if (topic !== 'workflows' || event.type !== 'workflow.step.end' || !JSON.stringify(event).includes('answer 2')) {
        return false;
      }
      refused = { visible: (await savedMessages()).some(message => message.id === sent!.signal.id) };
      return true;
    };
    toolGate.release();
    await done;

    expect(refused).toEqual({ visible: true });
    expect(prompts).toHaveLength(3);
    expect(occurrences(prompts[1], 'SAVED_BEFORE_THE_STATE')).toBe(1);
    expect(occurrences(prompts[2], 'SAVED_BEFORE_THE_STATE')).toBe(1);
    expect((await savedMessages()).filter(message => message.id === sent!.signal.id)).toHaveLength(1);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
    expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).toBeNull();
    // Nothing the run claimed is left hidden: a claim by the thread's next signal run returns nothing.
    await memoryStore.setSignalRun({ threadId: scope.threadId, runId: 'next-run' });
    expect(
      await memoryStore.claimPendingSignals({ threadId: scope.threadId, runId: 'next-run', consumedIds: [] }),
    ).toEqual([]);
  });
});

describe('signals a run consumed and memory never saved', () => {
  it('leaves no row for a transient signal', async () => {
    const { agent, memoryStore, scope, prompts, toolGate, start, savedMessages } = setup();
    const { done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'TRANSIENT_SEND', transient: true }, scope);
    await sent.accepted;
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'TRANSIENT_SEND')).toBe(1);
    expect((await savedMessages()).some(message => message.id === sent.signal.id)).toBe(false);
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
    // The run was closed, which deleted the row it consumed and never saved.
    expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).toBeNull();
    expect((memoryStore as ObservedMemory).calls.filter(call => call.op === 'close')).toContainEqual(
      expect.objectContaining({ consumedIds: [sent.signal.id] }),
    );
  });

  it.each([
    // The process that started the run settles it from the workflow's result.
    ['a pubsub inside the process', () => ({ memoryStore: new ObservedMemory(), pubsub: new EventEmitterPubSub() })],
    // The process's worker settles it from the failure event, as any worker does.
    [
      'a pubsub that reaches other processes',
      () => ({ memoryStore: new SharedObservedMemory(), pubsub: new BrokerLikePubSub() }),
    ],
  ] as const)(
    'closes a run that failed in the process that started it once, with what it consumed (%s)',
    async (_case, options) => {
      const { memoryStore, pubsub } = options();
      const { agent, scope, prompts, toolGate, start, afterFollowUps, savedMessages } = setup({
        memoryStore,
        pubsub,
        stopWhen: () => {
          throw new Error('stop condition failed');
        },
      });
      const { stream, done } = await start();
      // Taken by the drain after the tool, then the stop condition fails the run.
      const consumed = agent.sendSignal({ type: 'user', contents: 'CONSUMED_BEFORE_FAILURE' }, scope);
      await consumed.accepted;
      const followUpsDone = afterFollowUps();
      toolGate.release();
      await expect(done).rejects.toThrow('stop condition failed');
      await followUpsDone;

      expect(memoryStore.calls.filter(call => call.op === 'close' && call.runId === stream.runId)).toEqual([
        { op: 'close', runId: stream.runId, consumedIds: [consumed.signal.id] },
      ]);
      // The failed run's transcript was never saved, so the close deleted the row it took: no turn repeats it.
      expect(prompts.filter(prompt => !textOf(prompt).includes(BARRIER)).slice(1)).toEqual([]);
      expect((await savedMessages()).some(message => message.id === consumed.signal.id)).toBe(false);
      expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
      expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).not.toBe(stream.runId);
      // Nothing the run claimed is left hidden: a claim by the thread's next signal run returns nothing.
      await memoryStore.setSignalRun({ threadId: scope.threadId, runId: 'later-run' });
      expect(
        await memoryStore.claimPendingSignals({ threadId: scope.threadId, runId: 'later-run', consumedIds: [] }),
      ).toEqual([]);
    },
  );
});

describe('a run whose total deadline fires in the process that executes its steps', () => {
  it('closes with the signals of the transcript it saves: saved ones stay messages, a transient one leaves no row', async () => {
    const deadline = holdDeadline();
    const memoryStore = new ObservedMemory();
    const { agent, scope, prompts, promptsReached, toolGate, start, savedMessages } = setup({
      memoryStore,
      hangingCall: 2,
      totalMs: HELD_DEADLINE_MS,
    });
    const { stream, done } = await start();
    // Both are taken by the drain after the tool, so they are in the transcript the deadline saves.
    const saved = agent.sendSignal({ type: 'user', contents: 'SAVED_BY_THE_DEADLINE' }, scope);
    await saved.accepted;
    const transient = agent.sendSignal({ type: 'user', contents: 'TRANSIENT_AT_DEADLINE', transient: true }, scope);
    await transient.accepted;
    // Sent right before the claim of the model request the deadline cuts off: the first claim is the first
    // request's, then the signal-drain step's and the continuation check's.
    let late: ReturnType<typeof agent.sendSignal> | undefined;
    memoryStore.beforeClaim = async ({ runId }) => {
      if (runId !== stream.runId || memoryStore.claimsBy(runId) !== 3) return;
      late = agent.sendSignal({ type: 'user', contents: 'TAKEN_BY_THE_CUT_OFF_REQUEST' }, scope);
      await late.accepted;
    };
    toolGate.release();
    // The request after the tool holds the signals and runs until the deadline aborts it.
    await promptsReached(2);
    deadline.elapse();
    await expect(done).rejects.toMatchObject({ name: 'MastraTimeoutError' });

    expect(occurrences(prompts[1], 'SAVED_BY_THE_DEADLINE')).toBe(1);
    expect(occurrences(prompts[1], 'TRANSIENT_AT_DEADLINE')).toBe(1);
    expect(occurrences(prompts[1], 'TAKEN_BY_THE_CUT_OFF_REQUEST')).toBe(1);
    const close = memoryStore.calls.filter(call => call.op === 'close' && call.runId === stream.runId);
    expect(close).toHaveLength(1);
    // The deadline saves the cut-off request's transcript: both signals it holds stay messages, once each, and
    // the transient one leaves no row.
    const messages = await savedMessages();
    expect(messages.filter(message => message.id === saved.signal.id)).toHaveLength(1);
    expect(messages.filter(message => message.id === late!.signal.id)).toHaveLength(1);
    expect(messages.some(message => message.id === transient.signal.id)).toBe(false);
    expect(close[0]).toEqual({
      op: 'close',
      runId: stream.runId,
      consumedIds: expect.arrayContaining([saved.signal.id, transient.signal.id, late!.signal.id]),
    });
    expect(await memoryStore.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
    expect(await memoryStore.getSignalRun({ threadId: scope.threadId })).toBeNull();
    // Nothing the run claimed is left hidden: a claim by the thread's next signal run returns nothing.
    await memoryStore.setSignalRun({ threadId: scope.threadId, runId: 'next-run' });
    expect(
      await memoryStore.claimPendingSignals({ threadId: scope.threadId, runId: 'next-run', consumedIds: [] }),
    ).toEqual([]);
  });
});

describe('a parked run that is aborted', () => {
  it.each(['acknowledged abort', 'stream abort'] as const)(
    "closes it with the signal it took, and a signal pending for it is the thread's next turn (%s)",
    async path => {
      const memoryStore = new ObservedMemory();
      const { agent, mastra, scope, prompts, promptsReached, toolGate, start } = setup({ memoryStore, park: true });
      // The run is parked once its workflow saved the suspension, which it announces on the workflows topic.
      const suspended = gate();
      let runId: string | undefined;
      await mastra.pubsub.subscribe('workflows', event => {
        if (event.type === 'workflow.suspend' && event.runId === runId) suspended.release();
      });
      const { stream } = await start();
      runId = stream.runId;
      // Sent right before the model request after the tool claims: the first claim is the first request's, then
      // the signal-drain step's and the continuation check's.
      let taken: ReturnType<typeof agent.sendSignal> | undefined;
      memoryStore.beforeClaim = async ({ runId: claiming }) => {
        if (claiming !== stream.runId || memoryStore.claimsBy(claiming) !== 3) return;
        taken = agent.sendSignal({ type: 'user', contents: 'TAKEN_BEFORE_PARKING' }, scope);
        await taken.accepted;
      };
      toolGate.release();
      await stream.output.suspendPayload;
      await suspended.promise;
      expect(occurrences(prompts[1], 'TAKEN_BEFORE_PARKING')).toBe(1);

      const pending = agent.sendSignal({ type: 'user', contents: 'PENDING_WHILE_PARKED' }, scope);
      await expect(pending.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      if (path === 'acknowledged abort') await agent.__abortRunAcknowledged(stream.runId);
      else expect(agent.abortRunStream(stream.runId)).toBe(true);
      await promptsReached(3);

      expect(occurrences(prompts[2], 'PENDING_WHILE_PARKED')).toBe(1);
      expect(occurrences(prompts[2], 'TAKEN_BEFORE_PARKING')).toBe(1);
      expect(
        memoryStore.calls.some(
          call => call.op === 'claim' && call.runId !== stream.runId && call.ids.includes(taken!.signal.id),
        ),
      ).toBe(false);
      expect(memoryStore.calls).toContainEqual({
        op: 'close',
        runId: stream.runId,
        consumedIds: [taken!.signal.id],
      });
    },
  );
});

describe('a processor signal sent after its step ended', () => {
  it('cuts short a model request that has produced only reasoning, and the next request has it once', async () => {
    type SendSignal = NonNullable<Parameters<NonNullable<Processor['processInputStep']>>[0]['sendSignal']>;
    let firstStepSend: SendSignal | undefined;
    let reasoningRequestAborted = false;
    const prompts: unknown[] = [];
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt, abortSignal }) => {
        prompts.push(prompt);
        const call = prompts.length;
        if (call === 1) {
          return {
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'tool-call', toolCallId: 'call-noop', toolName: 'noop', input: '{}' },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        if (call === 2) {
          return {
            warnings: [],
            stream: new ReadableStream<LanguageModelV2StreamPart>({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'reasoning-start', id: 'thinking' });
                controller.enqueue({ type: 'reasoning-delta', id: 'thinking', delta: 'thinking' });
                // Ends only when the request is cut short.
                abortSignal?.addEventListener(
                  'abort',
                  () => {
                    reasoningRequestAborted = true;
                    controller.error(abortSignal.reason);
                  },
                  { once: true },
                );
                // A processor of the first step still holds its `sendSignal`, and sends while this request thinks.
                void firstStepSend!({ type: 'user', contents: 'LATE_PROCESSOR_SIGNAL' });
              },
            }),
          };
        }
        return {
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'answer' },
            { type: 'text-delta', id: 'answer', delta: 'answer' },
            { type: 'text-end', id: 'answer' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const storage = new InMemoryStore();
    const memoryStore = new ObservedMemory();
    storage.stores.memory = memoryStore;
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'late-processor-signal',
        name: 'late-processor-signal',
        instructions: 'Test',
        model,
        memory: new MockMemory({ storage }),
        tools: {
          noop: createTool({
            id: 'noop',
            description: 'Does nothing',
            inputSchema: z.object({}),
            execute: async () => 'ok',
          }),
        },
        inputProcessors: [
          {
            id: 'holds-send-signal',
            async processInputStep({ stepNumber, sendSignal }) {
              if (stepNumber === 0) firstStepSend = sendSignal;
            },
          },
        ],
      }),
      pubsub: new EventEmitterPubSub(),
    });
    new Mastra({ agents: { owner: agent }, storage, logger: false });
    const scope = { resourceId: `resource-${crypto.randomUUID()}`, threadId: `thread-${crypto.randomUUID()}` };
    const stream = await agent.stream('Start', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 4,
    });
    await stream.output.consumeStream();

    expect(reasoningRequestAborted).toBe(true);
    expect(prompts).toHaveLength(3);
    expect(occurrences(prompts[2], 'LATE_PROCESSOR_SIGNAL')).toBe(1);
    expect(memoryStore.calls.filter(call => call.op === 'enqueue' && call.toRunId === stream.runId)).toHaveLength(1);
  });
});

/** A pubsub that reaches other processes and redelivers, as a broker does. */
class BrokerLikePubSub extends EventEmitterPubSub {
  override get deliversAcrossProcesses(): boolean {
    return true;
  }
  override get redeliversUnacked(): boolean {
    return true;
  }
}

describe('evented agents whose signals stay in the process that runs them', () => {
  it.each([
    ['no memory', { withMemory: false }, 'the run has no memory, thread or resourceId'],
    [
      'memory storage without pending signals',
      { memoryStore: new NoPendingSignalsMemory() },
      "the agent's memory storage doesn't keep pending signals",
    ],
    [
      'memory storage kept per process',
      { memoryStore: new ObservedMemory() },
      "the agent's memory storage keeps pending signals in this process only",
    ],
  ] as const)('warns once when the pubsub reaches other processes (%s)', async (_case, options, reason) => {
    const { mastra, start, toolGate } = setup({ ...options, pubsub: new BrokerLikePubSub() });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const { done } = await start();
    toolGate.release();
    await done;

    expect(
      warn.mock.calls.filter(([message]) => String(message).includes('Signals sent to running evented agents')),
    ).toEqual([[expect.stringContaining(reason)]]);
  });

  it.each([
    ['no memory', { withMemory: false }],
    ['memory storage without pending signals', { memoryStore: new NoPendingSignalsMemory() }],
  ] as const)('delivers a signal sent during a tool from the in-process queue (%s)', async (_case, options) => {
    const { agent, mastra, scope, prompts, toolGate, start } = setup(options);
    const memoryStore = (await mastra.getStorage()!.getStore('memory'))!;
    const pendingSignals = vi.spyOn(memoryStore, 'enqueuePendingSignal');
    const { done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'IN_MEMORY_SEND' }, scope);
    await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver' });
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'IN_MEMORY_SEND')).toBe(1);
    expect(prompts).toHaveLength(2);
    expect(pendingSignals).not.toHaveBeenCalled();
  });

  it('stays quiet with a pubsub inside the process', () => {
    const mastra = new Mastra({ storage: new InMemoryStore(), pubsub: new EventEmitterPubSub(), logger: false });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    warnUnsharedAgentSignals(mastra, 'no-memory-thread');
    expect(warn).not.toHaveBeenCalled();
  });
});
