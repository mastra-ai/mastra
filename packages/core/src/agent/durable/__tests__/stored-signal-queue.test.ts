/**
 * Signals sent to a running evented agent whose storage keeps agent signals:
 * the sender stores them, the run's drain points claim them, and what a run
 * never took becomes the thread's next turn.
 */
import type { LanguageModelV2StreamPart } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { Processor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import type {
  AgentSignalClaimArgs,
  AgentSignalScope,
  AgentSignalWriteResult,
  StoredAgentSignal,
  StoredAgentSignalPayload,
} from '../../../storage/domains/agent-signals/base';
import { InMemoryAgentSignalsStorage } from '../../../storage/domains/agent-signals/inmemory';
import { InMemoryDB } from '../../../storage/domains/inmemory-db';
import { WorkflowsInMemory } from '../../../storage/domains/workflows/inmemory';
import { createTool } from '../../../tools';
import { warnUnsharedAgentSignals } from '../../../workflows/evented/setup-warning';
import { Agent } from '../../agent';
import { createSignal } from '../../signals';
import { toStoredSignalPayload } from '../../stored-signal-payload';
import { AgentThreadStreamRuntime } from '../../thread-stream-runtime';
import { agentThreadStreamTopic } from '../../thread-stream-topic';
import { DurableStepIds } from '../constants';
import { createEventedAgent } from '../create-evented-agent';

type EnqueueRow = {
  id: string;
  threadKey: string;
  runId: string | null;
  scope: AgentSignalScope;
  signal: StoredAgentSignalPayload;
};

/** Signal storage whose next insert fails, as a store that is briefly unreachable does. */
class FailingOnceSignals extends InMemoryAgentSignalsStorage {
  failNext = false;

  override async enqueue(row: EnqueueRow): Promise<AgentSignalWriteResult> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('signal store unavailable');
    }
    return super.enqueue(row);
  }
}

/** One signal storage shared by several Mastra instances, as a database is shared by several processes. */
class SharedSignals extends InMemoryAgentSignalsStorage {
  override get sharedAcrossProcesses(): boolean {
    return true;
  }
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => (release = resolve));
  return { promise, release };
}

type SignalsCall =
  | { op: 'enqueue'; id: string; runId: string | null }
  | { op: 'claim'; args: AgentSignalClaimArgs; ids: string[] }
  | { op: 'delete'; ids: string[]; failed?: true }
  | { op: 'closeRun'; runId: string; consumedIds: string[] };

/**
 * Signal storage that records every call that reached it, in order. The
 * hooks let a test hold an insert, or make one call fail after (or instead
 * of) its write, as a store that drops its connection mid-call does.
 */
class ObservedSignals extends InMemoryAgentSignalsStorage {
  readonly calls: SignalsCall[] = [];
  /** Runs before each insert reaches the store. */
  beforeEnqueue?: (row: EnqueueRow) => Promise<void>;
  /** Runs before each claim reaches the store. */
  beforeClaim?: (args: AgentSignalClaimArgs) => Promise<void>;
  /** Runs before each delete reaches the store; when it throws, the delete fails without deleting anything. */
  beforeDelete?: (args: { ids: string[] }) => Promise<void>;
  /** The next delete of this id fails after deleting. */
  failDeleteOf?: string;
  /** Runs once, in place of the next close, which fails if it throws. */
  beforeClose?: (args: { threadKey: string; runId: string; consumedIds: string[] }) => Promise<void>;
  /** Runs before each listing of pending rows, as the end-of-run check of a thread makes. */
  beforeListPending?: (args: { threadKey: string; runId?: string | null }) => void;

  override async enqueue(row: EnqueueRow): Promise<AgentSignalWriteResult> {
    await this.beforeEnqueue?.(row);
    this.calls.push({ op: 'enqueue', id: row.id, runId: row.runId });
    return super.enqueue(row);
  }

  /** The next claim that returns this id fails after claiming, as a claim whose answer was lost does. */
  failClaimOf?: string;

  override async claim(args: AgentSignalClaimArgs): Promise<StoredAgentSignal[]> {
    await this.beforeClaim?.(args);
    const rows = await super.claim(args);
    this.calls.push({ op: 'claim', args, ids: rows.map(row => row.id) });
    if (this.failClaimOf && rows.some(row => row.id === this.failClaimOf)) {
      this.failClaimOf = undefined;
      throw new Error('signal store unavailable');
    }
    return rows;
  }

  override async delete(args: { ids: string[] }): Promise<void> {
    try {
      await this.beforeDelete?.(args);
    } catch (error) {
      this.calls.push({ op: 'delete', ids: args.ids, failed: true });
      throw error;
    }
    await super.delete(args);
    this.calls.push({ op: 'delete', ids: args.ids });
    if (this.failDeleteOf && args.ids.includes(this.failDeleteOf)) {
      this.failDeleteOf = undefined;
      throw new Error('signal store unavailable');
    }
  }

  override async closeRun(args: { threadKey: string; runId: string; consumedIds: string[] }): Promise<void> {
    this.calls.push({ op: 'closeRun', runId: args.runId, consumedIds: args.consumedIds });
    const hook = this.beforeClose;
    this.beforeClose = undefined;
    await hook?.(args);
    await super.closeRun(args);
    this.afterClose?.(args);
  }

  /** Runs after each close that succeeded. */
  afterClose?: (args: { threadKey: string; runId: string; consumedIds: string[] }) => void;

  override async listPending(args: { threadKey: string; runId?: string | null }): Promise<StoredAgentSignal[]> {
    this.beforeListPending?.(args);
    return super.listPending(args);
  }

  /** Runs after each cancel, with the ids it deleted. */
  afterCancel?: (cancelledIds: string[]) => void;

  override async cancel(args: { threadKey: string; ids: string[] }): Promise<string[]> {
    const cancelled = await super.cancel(args);
    this.afterCancel?.(cancelled);
    return cancelled;
  }

  claimsOf(id: string) {
    return this.calls.filter(
      (call): call is Extract<SignalsCall, { op: 'claim' }> => call.op === 'claim' && call.ids.includes(id),
    );
  }
}

type StatusWrite = { workflowName: string; runId: string; status?: string };

/**
 * Workflow storage that runs a hook before a run's suspension is first saved,
 * which is the suspended iteration's status write, and holds that write until
 * the hook settles. Storage versions save the status through different calls.
 */
class SuspendGatedWorkflows extends WorkflowsInMemory {
  /** Runs once, before the first write that saves an iteration as suspended. */
  beforeSuspensionSaved?: () => Promise<void>;

  async #gate({ workflowName, status }: StatusWrite) {
    if (workflowName !== DurableStepIds.AGENTIC_EXECUTION || status !== 'suspended') return;
    const hook = this.beforeSuspensionSaved;
    this.beforeSuspensionSaved = undefined;
    await hook?.();
  }

  override async persistWorkflowSnapshot(args: Parameters<WorkflowsInMemory['persistWorkflowSnapshot']>[0]) {
    await this.#gate({ ...args, status: args.snapshot?.status });
    return super.persistWorkflowSnapshot(args);
  }

  override async updateWorkflowState(args: Parameters<WorkflowsInMemory['updateWorkflowState']>[0]) {
    await this.#gate({ ...args, status: args.opts?.status });
    return super.updateWorkflowState(args);
  }

  override async updateWorkflowRunHeader(args: Parameters<WorkflowsInMemory['updateWorkflowRunHeader']>[0]) {
    await this.#gate({ ...args, status: args.opts?.status });
    return super.updateWorkflowRunHeader(args);
  }
}

function textOf(prompt: unknown): string {
  return JSON.stringify(prompt);
}

/**
 * An evented agent whose first model call asks for a tool that waits for the
 * test; later calls answer with text. Every prompt is recorded.
 */
function setup({
  signals = new InMemoryAgentSignalsStorage(),
  failingAnswers,
  hostOnly = false,
  park = false,
  workflows,
  hangingCall,
  totalTimeoutMs,
  stopWhen,
  inputProcessors,
  outputProcessors,
}: {
  /** The run's stop condition. */
  stopWhen?: () => boolean;
  /** The agent's input processors. */
  inputProcessors?: Processor[];
  /** The agent's output processors. */
  outputProcessors?: Processor[];
  signals?: InMemoryAgentSignalsStorage;
  workflows?: WorkflowsInMemory;
  /** This model call streams nothing and ends only when its request is aborted. */
  hangingCall?: number;
  /** The run's total timeout. */
  totalTimeoutMs?: number;
  /** Makes the model calls after the tool fail while `while()` holds, each after `before` ran. */
  failingAnswers?: { before: (call: number) => Promise<void>; while: () => boolean };
  /** Attach the agent to its Mastra host without listing it in the host's agents. */
  hostOnly?: boolean;
  /** The model call after the tool asks for a tool that needs approval, so the run parks there. */
  park?: boolean;
} = {}) {
  const prompts: unknown[] = [];
  const promptWaiters: Array<{ count: number; reached: () => void }> = [];
  /** Resolves once the model was called `count` times. */
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
      if (call >= 2 && failingAnswers?.while()) {
        await failingAnswers.before(call);
        throw new Error('model unavailable');
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
  storage.stores.agentSignals = signals;
  if (workflows) storage.stores.workflows = workflows;
  const memory = new MockMemory({ storage });
  const pubsub = new EventEmitterPubSub();
  const agent = createEventedAgent({
    agent: new Agent({
      id: 'stored-signals',
      name: 'stored-signals',
      instructions: 'Test',
      model,
      memory,
      tools: { wait, confirm },
      ...(inputProcessors ? { inputProcessors } : {}),
      ...(outputProcessors ? { outputProcessors } : {}),
    }),
    pubsub,
  });
  const mastra = new Mastra({ agents: hostOnly ? {} : { owner: agent }, storage, logger: false });
  if (hostOnly) agent.__registerMastra(mastra);
  const scope = { resourceId: `resource-${crypto.randomUUID()}`, threadId: `thread-${crypto.randomUUID()}` };
  const threadKey = `${scope.resourceId}\u0000${scope.threadId}`;
  const start = async () => {
    const stream = await agent.stream('Start', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      maxSteps: 4,
      ...(totalTimeoutMs ? { modelSettings: { timeout: { totalMs: totalTimeoutMs } } } : {}),
      ...(stopWhen ? { stopWhen } : {}),
    });
    const chunks: Array<{ type: string; payload?: any; data?: any }> = [];
    // Rejects when the run reports an error, so a test that expects none sees it.
    const done = (async () => {
      for await (const chunk of stream.fullStream) chunks.push(chunk as (typeof chunks)[number]);
      const error = chunks.find(chunk => chunk.type === 'error');
      if (error) throw error.payload?.error ?? new Error('the run reported an error');
    })();
    await toolReached.promise;
    return { stream, done, chunks };
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
  return {
    agent,
    mastra,
    signals,
    scope,
    threadKey,
    prompts,
    promptsReached,
    toolGate,
    start,
    afterFollowUps,
    pubsub,
    memory,
  };
}

const BARRIER = 'BARRIER_QUEUED_AFTER_THE_RUN';

/** How many times `text` occurs in a model prompt. */
function occurrences(prompt: unknown, text: string): number {
  return textOf(prompt).split(text).length - 1;
}

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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signals of a running evented agent kept in storage', () => {
  it('delivers two sends made back to back to the next model call in send order', async () => {
    const signals = new ObservedSignals();
    // The first insert is slow; the second send must still reach the store after it.
    const firstInsert = gate();
    let held = false;
    signals.beforeEnqueue = async () => {
      if (held) return;
      held = true;
      await firstInsert.promise;
    };
    const { agent, scope, prompts, toolGate, start } = setup({ signals });
    const { done } = await start();
    const first = agent.sendSignal({ type: 'user', contents: 'FIRST_SEND' }, scope);
    const second = agent.sendSignal({ type: 'user', contents: 'SECOND_SEND' }, scope);
    firstInsert.release();
    const [firstAccepted, secondAccepted] = await Promise.all([first.accepted, second.accepted]);
    expect(firstAccepted).toMatchObject({ action: 'deliver' });
    expect(secondAccepted).toMatchObject({ action: 'deliver' });
    expect(signals.calls.filter(call => call.op === 'enqueue').map(call => call.id)).toEqual([
      first.signal.id,
      second.signal.id,
    ]);
    toolGate.release();
    await done;

    const afterTool = textOf(prompts[1]);
    expect(occurrences(prompts[1], 'FIRST_SEND')).toBe(1);
    expect(occurrences(prompts[1], 'SECOND_SEND')).toBe(1);
    expect(afterTool.indexOf('SECOND_SEND')).toBeGreaterThan(afterTool.indexOf('FIRST_SEND'));
    expect(prompts).toHaveLength(2);
  });

  it('does not report a failed insert as delivered, and the next send on the thread still arrives', async () => {
    const signals = new FailingOnceSignals();
    const { agent, scope, prompts, toolGate, start } = setup({ signals });
    const { done } = await start();
    signals.failNext = true;
    const failed = agent.sendSignal({ type: 'user', contents: 'LOST_SEND' }, scope);
    await expect(failed.accepted).rejects.toThrow('signal store unavailable');
    const next = agent.sendSignal({ type: 'user', contents: 'LATER_SEND' }, scope);
    await expect(next.accepted).resolves.toMatchObject({ action: 'deliver' });
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'LATER_SEND')).toBe(1);
    expect(prompts.map(textOf).some(prompt => prompt.includes('LOST_SEND'))).toBe(false);
  });

  it('reports a signal cancelled before any drain took it through settled, and never delivers it', async () => {
    const { agent, scope, prompts, toolGate, start } = setup();
    const { done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'CANCELLED_SEND' }, scope);
    await sent.accepted;
    const cancelled = agent.cancelQueuedMessages({ ...scope, signalIds: [sent.signal.id] });
    expect(cancelled.cancelledSignalIds).toEqual([]);
    await expect(cancelled.settled).resolves.toEqual({ cancelledSignalIds: [sent.signal.id] });
    toolGate.release();
    await done;

    expect(prompts.map(textOf).some(prompt => prompt.includes('CANCELLED_SEND'))).toBe(false);
    expect(prompts).toHaveLength(2);
  });

  it('cancels nothing once a drain took the signal, which stays in the transcript', async () => {
    const { agent, signals, scope, prompts, toolGate, start } = setup();
    const { stream, done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'TAKEN_SEND' }, scope);
    await sent.accepted;
    // The next claim of the run takes the row, as the drain after the tool does.
    const threadKey = `${scope.resourceId}\u0000${scope.threadId}`;
    await signals.claim({ threadKey, runId: stream.runId, scope: 'pending' });
    const cancelled = agent.cancelQueuedMessages({ ...scope, signalIds: [sent.signal.id] });
    await expect(cancelled.settled).resolves.toEqual({ cancelledSignalIds: [] });
    toolGate.release();
    await done;

    expect(occurrences(prompts[1], 'TAKEN_SEND')).toBe(1);
  });

  it("delivers a signal sent during a failed model call once, in the run's next request", async () => {
    let send!: (contents: string) => Promise<string>;
    const signals = new ObservedSignals();
    let sentId = '';
    let failed = false;
    const { agent, scope, prompts, toolGate, start, afterFollowUps } = setup({
      signals,
      failingAnswers: {
        // Sent while the failing model call is in flight; the loop drains it after that call and asks again.
        before: async () => {
          failed = true;
          sentId = await send('SENT_DURING_FAILURE');
        },
        while: () => !failed,
      },
    });
    send = async contents => {
      const sent = agent.sendSignal({ type: 'user', contents }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver' });
      return sent.signal.id;
    };
    const { stream, done } = await start();
    // Taken by the drain after the tool, into the model call that fails.
    await send('TAKEN_BEFORE_FAILURE');
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    await followUpsDone;

    expect(occurrences(prompts[1], 'TAKEN_BEFORE_FAILURE')).toBe(1);
    const turns = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(turns).toHaveLength(3);
    expect(occurrences(turns[2], 'SENT_DURING_FAILURE')).toBe(1);
    expect(occurrences(turns[2], 'TAKEN_BEFORE_FAILURE')).toBe(1);
    // Only the run itself took it, and no later turn got it again.
    expect(signals.claimsOf(sentId).map(claim => claim.args.runId)).toEqual([stream.runId]);
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(sentId))).toEqual([
      { op: 'delete', ids: [sentId] },
    ]);
  });

  it('makes a send that finds the run closed the next turn in the process holding the run', async () => {
    const { agent, signals, scope, prompts, toolGate, start, afterFollowUps } = setup();
    const { stream, done } = await start();
    // The executing process closed the run before this send was stored, as finalize does before FINISH.
    const threadKey = `${scope.resourceId}\u0000${scope.threadId}`;
    await signals.closeRun({ threadKey, runId: stream.runId, consumedIds: [] });
    const sent = agent.sendSignal({ type: 'user', contents: 'AFTER_CLOSE_SEND' }, scope);
    await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    await followUpsDone;

    expect(textOf(prompts[1])).not.toContain('AFTER_CLOSE_SEND');
    const followUps = prompts.slice(2).filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(followUps).toHaveLength(1);
    expect(occurrences(followUps[0], 'AFTER_CLOSE_SEND')).toBe(1);
  });
});

/** The signal chunks of a stream that carry `contents`. */
function signalChunksOf(chunks: Array<{ type: string }>, contents: string) {
  return chunks.filter(chunk => chunk.type.startsWith('data-') && JSON.stringify(chunk).includes(contents));
}

describe('consumed signals of a storage-backed run', () => {
  it("streams a signal the loop's continuation check takes once, and asks the model once for it", async () => {
    const signals = new ObservedSignals();
    const { agent, scope, prompts, toolGate, start } = setup({ signals });
    const { stream, done, chunks } = await start();
    // Sent right before the continuation check after the tool reads the store. The signal-drain step reads it first.
    let pendingClaims = 0;
    let sent: ReturnType<typeof agent.sendSignal> | undefined;
    signals.beforeClaim = async args => {
      if (args.scope !== 'pending' || args.runId !== stream.runId || ++pendingClaims !== 2) return;
      sent = agent.sendSignal({ type: 'user', contents: 'TAKEN_BY_THE_CHECK' }, scope);
      await sent.accepted;
    };
    toolGate.release();
    await done;

    expect(signals.claimsOf(sent!.signal.id)).toHaveLength(1);
    expect(signalChunksOf(chunks, 'TAKEN_BY_THE_CHECK')).toHaveLength(1);
    expect(prompts).toHaveLength(2);
    expect(occurrences(prompts[1], 'TAKEN_BY_THE_CHECK')).toBe(1);
  });

  it('starts a follow-up turn with a leftover once, and deletes its row', async () => {
    const signals = new ObservedSignals();
    const { agent, scope, threadKey, prompts, toolGate, start } = setup({ signals });
    // Every chunk of the thread's runs, up to the follow-up's finish.
    const chunks: Array<{ type: string }> = [];
    const followUpFinished = gate();
    const subscription = await agent.subscribeToThread(scope);
    const observed = (async () => {
      for await (const chunk of subscription.stream) {
        chunks.push(chunk as { type: string });
        if (chunks.filter(seen => seen.type === 'finish').length === 2) followUpFinished.release();
      }
    })();
    const { stream, done } = await start();
    // The run closed before this send was stored, so it is left to the thread's next turn.
    await signals.closeRun({ threadKey, runId: stream.runId, consumedIds: [] });
    const sent = agent.sendSignal({ type: 'user', contents: 'FOLLOW_UP_INPUT' }, scope);
    await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
    toolGate.release();
    await done;
    await followUpFinished.promise;
    subscription.unsubscribe();
    await observed;

    // One model call for it, which has it once.
    expect(prompts).toHaveLength(3);
    expect(occurrences(prompts[2], 'FOLLOW_UP_INPUT')).toBe(1);
    const followUpChunks = chunks.slice(chunks.findIndex(chunk => chunk.type === 'finish') + 1);
    expect(signalChunksOf(followUpChunks, 'FOLLOW_UP_INPUT').map(chunk => chunk.type)).toEqual(['data-user-message']);
    // The follow-up's first request found it in the turn's input: its read deleted the row instead of claiming it.
    expect(signals.claimsOf(sent.signal.id)).toEqual([]);
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(sent.signal.id))).toEqual([
      { op: 'delete', ids: [sent.signal.id] },
    ]);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });
});

describe('a run that ends without finishing', () => {
  it("closes a failed run with what it consumed, and the signal it never took is the thread's next turn", async () => {
    const signals = new ObservedSignals();
    const { agent, mastra, scope, threadKey, prompts, toolGate, start, afterFollowUps } = setup({
      signals,
      stopWhen: () => {
        throw new Error('stop condition failed');
      },
    });
    const terminal: string[] = [];
    let runId: string | undefined;
    await mastra.pubsub.subscribe('workflows', event => {
      if (event.runId === runId && ['workflow.fail', 'workflow.cancel', 'workflow.end'].includes(event.type)) {
        terminal.push(event.type);
      }
    });
    const { stream, done } = await start();
    runId = stream.runId;
    // Taken by the continuation check after the tool, which saves it as consumed and then fails the run.
    let consumed: ReturnType<typeof agent.sendSignal> | undefined;
    let pendingClaims = 0;
    signals.beforeClaim = async args => {
      if (args.scope !== 'pending' || args.runId !== stream.runId || ++pendingClaims !== 2) return;
      consumed = agent.sendSignal({ type: 'user', contents: 'CONSUMED_BEFORE_FAILURE' }, scope);
      await consumed.accepted;
    };
    // Sent after the run's last drain and before its close, so the run never takes it.
    let untakenId = '';
    signals.beforeClose = async ({ runId: closing }) => {
      const untaken = agent.sendSignal({ type: 'user', contents: 'UNTAKEN_AT_FAILURE' }, scope);
      await expect(untaken.accepted).resolves.toMatchObject({ action: 'deliver', runId: closing });
      untakenId = untaken.signal.id;
    };
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await expect(done).rejects.toThrow('stop condition failed');
    await followUpsDone;

    expect(terminal).toEqual(['workflow.fail']);
    expect(signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId)).toEqual([
      { op: 'closeRun', runId: stream.runId, consumedIds: [consumed!.signal.id] },
    ]);
    const turns = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(turns).toHaveLength(2);
    expect(occurrences(turns[1], 'UNTAKEN_AT_FAILURE')).toBe(1);
    expect(occurrences(turns[1], 'CONSUMED_BEFORE_FAILURE')).toBe(0);
    expect(signals.claimsOf(consumed!.signal.id).map(claim => claim.args.runId)).toEqual([stream.runId]);
    // The follow-up started with it as input, and its first read deleted the row.
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(untakenId))).toEqual([
      { op: 'delete', ids: [untakenId] },
    ]);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });
});

describe('a running run that is cancelled', () => {
  it("repeats no signal it took, and the one it never took is the thread's next turn once", async () => {
    const signals = new ObservedSignals();
    const { agent, mastra, scope, threadKey, prompts, promptsReached, toolGate, start, afterFollowUps } = setup({
      signals,
      hangingCall: 2,
    });
    const terminal: string[] = [];
    let runId: string | undefined;
    await mastra.pubsub.subscribe('workflows', event => {
      if (event.runId === runId && ['workflow.fail', 'workflow.cancel', 'workflow.end'].includes(event.type)) {
        terminal.push(event.type);
      }
    });
    const { stream, done } = await start();
    runId = stream.runId;
    // Taken by the drain after the tool, into the model request the cancel cuts off.
    const taken = agent.sendSignal({ type: 'user', contents: 'TAKEN_BEFORE_CANCEL' }, scope);
    await taken.accepted;
    // Sent once the run is being closed, so the run never takes it.
    let untakenId = '';
    signals.beforeClose = async ({ runId: closing }) => {
      const untaken = agent.sendSignal({ type: 'user', contents: 'UNTAKEN_AT_CANCEL' }, scope);
      await expect(untaken.accepted).resolves.toMatchObject({ action: 'deliver', runId: closing });
      untakenId = untaken.signal.id;
    };
    toolGate.release();
    await promptsReached(2);
    const followUpsDone = afterFollowUps();
    expect(agent.abortRunStream(stream.runId)).toBe(true);
    await done.catch(() => {});
    await followUpsDone;

    // A cancel ends the run through its finish step, which closes it with what it consumed.
    expect(terminal).toEqual(['workflow.end']);
    expect(signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId)).toEqual([
      { op: 'closeRun', runId: stream.runId, consumedIds: [] },
    ]);
    expect(occurrences(prompts[1], 'TAKEN_BEFORE_CANCEL')).toBe(1);
    expect(signals.claimsOf(taken.signal.id).map(claim => claim.args.runId)).toEqual([stream.runId]);
    const turns = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(turns).toHaveLength(3);
    expect(occurrences(turns[2], 'UNTAKEN_AT_CANCEL')).toBe(1);
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(untakenId))).toEqual([
      { op: 'delete', ids: [untakenId] },
    ]);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });
});

describe('stored signals when the store fails part way', () => {
  it('delivers a signal once when the claim that took it lost its answer', async () => {
    const signals = new ObservedSignals();
    const { agent, scope, threadKey, prompts, toolGate, start } = setup({ signals });
    const { stream, done, chunks } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'CLAIM_ANSWER_LOST' }, scope);
    await sent.accepted;
    // The drain after the tool claims the row and then fails; the run's next claim returns it again.
    signals.failClaimOf = sent.signal.id;
    toolGate.release();
    await done;

    expect(signals.claimsOf(sent.signal.id).map(claim => claim.args.runId)).toEqual([stream.runId, stream.runId]);
    expect(prompts).toHaveLength(2);
    expect(occurrences(prompts[1], 'CLAIM_ANSWER_LOST')).toBe(1);
    expect(signalChunksOf(chunks, 'CLAIM_ANSWER_LOST')).toHaveLength(1);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });

  it('keeps the consumed set when the delete of the next drain fails before deleting, and delivers the signal once', async () => {
    const signals = new ObservedSignals();
    const { agent, scope, threadKey, prompts, toolGate, start, afterFollowUps } = setup({ signals });
    const { stream, done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'UNDELETED_SEND' }, scope);
    await sent.accepted;
    const id = sent.signal.id;
    // The first drain after the tool takes it; the next one fails to delete it and changes nothing. The drain after
    // that deletes it again, which shows the failed one left the id in the run's saved set. By then the row is still
    // the run's: a leftover stored under its id leaves that row as it is instead of adding one.
    let deletes = 0;
    let stillClaimed: StoredAgentSignal[] | undefined;
    signals.beforeDelete = async ({ ids }) => {
      if (!ids.includes(id)) return;
      if (++deletes === 1) throw new Error('signal store unavailable');
      await signals.enqueue({
        id,
        threadKey,
        runId: null,
        scope: 'pending',
        signal: toStoredSignalPayload(sent.signal),
      });
      stillClaimed = await signals.listPending({ threadKey, runId: null });
    };
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    await followUpsDone;

    expect(signals.claimsOf(id).map(claim => claim.args.runId)).toEqual([stream.runId]);
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(id))).toEqual([
      { op: 'delete', ids: [id], failed: true },
      { op: 'delete', ids: [id] },
    ]);
    expect(stillClaimed).toEqual([]);
    expect(occurrences(prompts[1], 'UNDELETED_SEND')).toBe(1);
    const turns = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(turns).toHaveLength(2);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });

  it('deletes a consumed signal at the next drain, and delivers it once when that delete fails', async () => {
    const signals = new ObservedSignals();
    const { agent, scope, threadKey, prompts, toolGate, start } = setup({ signals });
    const { stream, done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'DELETED_SEND' }, scope);
    await sent.accepted;
    // The delete removes the row, then reports a failure.
    signals.failDeleteOf = sent.signal.id;
    toolGate.release();
    await done;

    // Taken by the first drain after the tool and deleted by the next one, whose failure keeps the id in the run's
    // saved set: the drain after that deletes it again and finds nothing.
    const id = sent.signal.id;
    expect(
      signals.calls
        .filter(call => (call.op === 'claim' || call.op === 'delete') && call.ids.includes(id))
        .map(call => (call.op === 'claim' ? { op: call.op, runId: call.args.runId, ids: call.ids } : call)),
    ).toEqual([
      { op: 'claim', runId: stream.runId, ids: [id] },
      { op: 'delete', ids: [id] },
      { op: 'delete', ids: [id] },
    ]);
    expect(occurrences(prompts[1], 'DELETED_SEND')).toBe(1);
    expect(prompts).toHaveLength(2);
    expect(await signals.listPending({ threadKey })).toEqual([]);
    const closes = signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId);
    expect(closes).toHaveLength(1);
    expect(closes[0]).toMatchObject({ consumedIds: [] });
  });

  it("ends a run whose close fails, and the signal it left becomes the thread's next turn", async () => {
    const signals = new ObservedSignals();
    const { agent, scope, threadKey, prompts, toolGate, start, afterFollowUps } = setup({ signals });
    let leftOverId = '';
    signals.beforeClose = async ({ runId }) => {
      // Sent after the run's last drain and before its close, so nothing of the run takes it.
      const sent = agent.sendSignal({ type: 'user', contents: 'UNCLOSED_SEND' }, scope);
      await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver', runId });
      leftOverId = sent.signal.id;
      throw new Error('signal store unavailable');
    };
    const { stream, done } = await start();
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    await followUpsDone;

    expect(await stream.output.finishReason).toBe('stop');
    const turns = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(turns).toHaveLength(3);
    expect(occurrences(turns[1], 'UNCLOSED_SEND')).toBe(0);
    expect(occurrences(turns[2], 'UNCLOSED_SEND')).toBe(1);
    // The follow-up's first request took over the thread, which closed the run that failed to close.
    expect(signals.claimsOf(leftOverId).every(claim => claim.args.runId !== stream.runId)).toBe(true);
    const late = createSignal({ type: 'user', contents: 'LATE', id: crypto.randomUUID() });
    await expect(
      signals.enqueue({
        id: late.id,
        threadKey,
        runId: stream.runId,
        scope: 'pending',
        signal: toStoredSignalPayload(late),
      }),
    ).resolves.toBe('run-closed');
  });
});

describe('a run cut off by its total timeout', () => {
  it('saves the signal its last model request took once, and leaves no row or turn for it', async () => {
    const deadline = holdDeadline();
    const signals = new ObservedSignals();
    const { agent, memory, scope, threadKey, prompts, promptsReached, toolGate, start } = setup({
      signals,
      hangingCall: 2,
      totalTimeoutMs: HELD_DEADLINE_MS,
    });
    const { stream, done } = await start();
    // Sent right before the model request after the tool reads the store, so that request takes it.
    let taken: ReturnType<typeof agent.sendSignal> | undefined;
    let pendingClaims = 0;
    signals.beforeClaim = async args => {
      if (args.scope !== 'pending' || args.runId !== stream.runId || ++pendingClaims !== 3) return;
      taken = agent.sendSignal({ type: 'user', contents: 'TAKEN_BEFORE_DEADLINE' }, scope);
      await taken.accepted;
    };
    const closed = gate();
    signals.afterClose = ({ runId }) => {
      if (runId === stream.runId) closed.release();
    };
    toolGate.release();
    // The request after the tool holds the signal and runs until the deadline aborts it.
    await promptsReached(2);
    deadline.elapse();
    await expect(done).rejects.toMatchObject({ name: 'MastraTimeoutError' });
    await expect(stream.output.steps).rejects.toMatchObject({ name: 'MastraTimeoutError' });
    // The deadline saves memory and then closes the run; the caller may see the deadline before both end.
    await closed.promise;

    expect(prompts).toHaveLength(2);
    expect(occurrences(prompts[1], 'TAKEN_BEFORE_DEADLINE')).toBe(1);
    const { messages } = await memory.recall({ threadId: scope.threadId, resourceId: scope.resourceId });
    expect(messages.filter(message => JSON.stringify(message).includes('TAKEN_BEFORE_DEADLINE'))).toHaveLength(1);
    // The run was closed with it, so its row is gone rather than left for the thread's next turn.
    expect(signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId)).toEqual([
      { op: 'closeRun', runId: stream.runId, consumedIds: [taken!.signal.id] },
    ]);
    expect(await signals.listPending({ threadKey })).toEqual([]);
    const nextRunId = crypto.randomUUID();
    await expect(signals.claim({ threadKey, runId: nextRunId, scope: 'pre-run', leftovers: true })).resolves.toEqual(
      [],
    );
  });

  // The deadline chooses what to save once the run's steps settled, but the next model request reads the store
  // before it counts as started. A signal that request takes after the choice is in no saved transcript, so the close
  // must leave it to the thread's next run instead of deleting it.
  it("leaves a signal taken after the deadline chose what to save to the thread's next run", async () => {
    const deadline = holdDeadline();
    const signals = new ObservedSignals();
    // Holds the deadline's save once it chose its transcript: its output processors run over it.
    const saveReached = gate();
    const saveRelease = gate();
    let deadlineFired = false;
    const { agent, mastra, memory, scope, threadKey, prompts, toolGate, start } = setup({
      signals,
      totalTimeoutMs: HELD_DEADLINE_MS,
      outputProcessors: [
        {
          id: 'held-deadline-save',
          async processOutputResult({ messages }) {
            if (deadlineFired) {
              saveReached.release();
              await saveRelease.promise;
            }
            return messages;
          },
        },
      ],
    });
    const failed = gate();
    let runId: string | undefined;
    await mastra.pubsub.subscribe('workflows', event => {
      if (event.runId === runId && event.type === 'workflow.fail') failed.release();
    });
    const { stream, done } = await start();
    runId = stream.runId;
    // The model request after the tool reads the store; the signal is sent and the deadline elapses right before.
    let late: ReturnType<typeof agent.sendSignal> | undefined;
    let pendingClaims = 0;
    signals.beforeClaim = async args => {
      if (args.scope !== 'pending' || args.runId !== stream.runId || ++pendingClaims !== 3) return;
      late = agent.sendSignal({ type: 'user', contents: 'TAKEN_AFTER_THE_CHOICE' }, scope);
      await late.accepted;
      deadlineFired = true;
      deadline.elapse();
      await saveReached.promise;
    };
    const closed = gate();
    signals.afterClose = ({ runId: closedRunId }) => {
      if (closedRunId === stream.runId) closed.release();
    };
    toolGate.release();
    // The request took the signal into its transcript and its step ended, which ends the run's workflow.
    await failed.promise;
    expect(signals.claimsOf(late!.signal.id).map(claim => claim.args.runId)).toEqual([stream.runId]);
    saveRelease.release();
    await expect(done).rejects.toMatchObject({ name: 'MastraTimeoutError' });
    await closed.promise;

    expect(prompts).toHaveLength(1);
    const { messages } = await memory.recall({ threadId: scope.threadId, resourceId: scope.resourceId });
    expect(messages.filter(message => JSON.stringify(message).includes('TAKEN_AFTER_THE_CHOICE'))).toHaveLength(0);
    // Closed with the signals of what the deadline saved, which has none, and left to the thread's next turn.
    expect(signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId)).toEqual([
      { op: 'closeRun', runId: stream.runId, consumedIds: [] },
    ]);
    expect((await signals.listPending({ threadKey })).map(row => [row.id, row.runId])).toEqual([
      [late!.signal.id, null],
    ]);
    // The thread's next run takes it at its first model request.
    const nextRunId = crypto.randomUUID();
    const taken = await signals.claim({ threadKey, runId: nextRunId, scope: 'pre-run', leftovers: true });
    expect(taken.map(row => row.id)).toEqual([late!.signal.id]);
  });

  // A signal the drain after a tool takes is deleted by the next drain, while the next model request has not yet
  // captured the transcript that holds it. A deadline in between must save that transcript.
  it('saves a signal the drain after a tool took when the deadline elapses before the next model request', async () => {
    const deadline = holdDeadline();
    const signals = new ObservedSignals();
    const { agent, memory, scope, threadKey, prompts, toolGate, start } = setup({
      signals,
      totalTimeoutMs: HELD_DEADLINE_MS,
    });
    const { stream, done } = await start();
    const closed = gate();
    signals.afterClose = ({ runId }) => {
      if (runId === stream.runId) closed.release();
    };
    // The signal-drain step after the tool takes it, and the loop's continuation check deletes its row. The deadline
    // elapses as the model request after them reads the store, which waits until the run is closed.
    let drained: ReturnType<typeof agent.sendSignal> | undefined;
    let pendingClaims = 0;
    signals.beforeClaim = async args => {
      if (args.scope !== 'pending' || args.runId !== stream.runId) return;
      pendingClaims++;
      if (pendingClaims === 1) {
        drained = agent.sendSignal({ type: 'user', contents: 'TAKEN_BY_THE_DRAIN_STEP' }, scope);
        await drained.accepted;
      } else if (pendingClaims === 3) {
        deadline.elapse();
        await closed.promise;
      }
    };
    toolGate.release();
    await expect(done).rejects.toMatchObject({ name: 'MastraTimeoutError' });
    await closed.promise;

    expect(prompts).toHaveLength(1);
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(drained!.signal.id))).toEqual([
      { op: 'delete', ids: [drained!.signal.id] },
    ]);
    const { messages } = await memory.recall({ threadId: scope.threadId, resourceId: scope.resourceId });
    expect(messages.filter(message => JSON.stringify(message).includes('TAKEN_BY_THE_DRAIN_STEP'))).toHaveLength(1);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });
});

describe('a parked run that is aborted', () => {
  it.each(['acknowledged abort', 'stream abort'] as const)(
    "turns its pending signal into the thread's next turn and repeats none it took (%s)",
    async path => {
      const signals = new ObservedSignals();
      const { agent, mastra, scope, prompts, promptsReached, toolGate, start } = setup({ signals, park: true });
      // The run is parked once its workflow saved the suspension, which it announces on the workflows topic.
      const suspended = gate();
      let runId: string | undefined;
      await mastra.pubsub.subscribe('workflows', event => {
        if (event.type === 'workflow.suspend' && event.runId === runId) suspended.release();
      });
      const { stream } = await start();
      runId = stream.runId;
      // Sent right before the model request after the tool reads the store, so that request takes it and the
      // run parks with it in its consumed set: only the close deletes its row.
      let taken: ReturnType<typeof agent.sendSignal> | undefined;
      let pendingClaims = 0;
      signals.beforeClaim = async args => {
        // The loop's drains after the tool come first: the signal-drain step's, then the predicate's.
        if (args.scope !== 'pending' || args.runId !== stream.runId || ++pendingClaims !== 3) return;
        taken = agent.sendSignal({ type: 'user', contents: 'TAKEN_BEFORE_PARKING' }, scope);
        await taken.accepted;
      };
      toolGate.release();
      // Parked on the approval the model call after the tool asked for.
      await stream.output.suspendPayload;
      await suspended.promise;
      expect(taken).toBeDefined();
      expect(signals.claimsOf(taken!.signal.id)).toHaveLength(1);
      expect(occurrences(prompts[1], 'TAKEN_BEFORE_PARKING')).toBe(1);

      const pending = agent.sendSignal({ type: 'user', contents: 'PENDING_WHILE_PARKED' }, scope);
      await expect(pending.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
      if (path === 'acknowledged abort') await agent.__abortRunAcknowledged(stream.runId);
      else expect(agent.abortRunStream(stream.runId)).toBe(true);
      await promptsReached(3);

      expect(occurrences(prompts[2], 'PENDING_WHILE_PARKED')).toBe(1);
      const followUpClaims = signals.calls.filter(
        (call): call is Extract<SignalsCall, { op: 'claim' }> =>
          call.op === 'claim' && call.args.runId !== stream.runId,
      );
      expect(followUpClaims.some(claim => claim.ids.includes(taken!.signal.id))).toBe(false);
      // The parked run was closed with the signal it took, which no later run gets back.
      expect(signals.calls).toContainEqual({ op: 'closeRun', runId: stream.runId, consumedIds: [taken!.signal.id] });
    },
  );

  it.each([
    ['acknowledged abort', 'no signal pending'],
    ['stream abort', 'no signal pending'],
    ['acknowledged abort', 'a signal pending'],
    ['stream abort', 'a signal pending'],
  ] as const)(
    "repeats no signal it took when aborted before its suspension is saved, and a pending one is the thread's next turn (%s, %s)",
    async (path, pendingCase) => {
      const signals = new ObservedSignals();
      const workflows = new SuspendGatedWorkflows({ db: new InMemoryDB() });
      const { agent, scope, threadKey, prompts, toolGate, start, afterFollowUps } = setup({
        signals,
        workflows,
        park: true,
      });
      const { stream } = await start();
      // Taken by the model request after the tool, as in the parked run above.
      let taken: ReturnType<typeof agent.sendSignal> | undefined;
      let pendingClaims = 0;
      signals.beforeClaim = async args => {
        if (args.scope !== 'pending' || args.runId !== stream.runId || ++pendingClaims !== 3) return;
        taken = agent.sendSignal({ type: 'user', contents: 'TAKEN_BEFORE_PARKING' }, scope);
        await taken.accepted;
      };
      // The run is parked here (its stream reported the approval), but its suspension is not saved until the
      // abort settled what it closes, which the thread's end-of-run check marks by listing the thread's rows.
      let acknowledged: Promise<boolean> | undefined;
      let followUpsDone: Promise<void> | undefined;
      const settled = gate();
      workflows.beforeSuspensionSaved = async () => {
        if (pendingCase === 'a signal pending') {
          const pending = agent.sendSignal({ type: 'user', contents: 'PENDING_WHILE_PARKING' }, scope);
          await expect(pending.accepted).resolves.toMatchObject({ action: 'deliver', runId: stream.runId });
        }
        followUpsDone = afterFollowUps();
        const checked = gate();
        signals.beforeListPending = args => {
          if (args.threadKey === threadKey && args.runId === undefined) checked.release();
        };
        if (path === 'acknowledged abort') acknowledged = agent.__abortRunAcknowledged(stream.runId);
        else expect(agent.abortRunStream(stream.runId)).toBe(true);
        await checked.promise;
        settled.release();
      };
      toolGate.release();
      await settled.promise;
      await followUpsDone;
      if (acknowledged) await expect(acknowledged).resolves.toBe(true);

      expect(occurrences(prompts[1], 'TAKEN_BEFORE_PARKING')).toBe(1);
      expect(signals.claimsOf(taken!.signal.id).map(claim => claim.args.runId)).toEqual([stream.runId]);
      const turns = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
      if (pendingCase === 'a signal pending') {
        expect(turns).toHaveLength(3);
        expect(occurrences(turns[2], 'PENDING_WHILE_PARKING')).toBe(1);
      } else {
        // The signal the run took starts no turn of its own.
        expect(turns).toHaveLength(2);
      }
      // Left open by the abort, and closed by the next run's takeover.
      expect(signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId)).toEqual([]);
      expect(await signals.listPending({ threadKey })).toEqual([]);
      const late = createSignal({ type: 'user', contents: 'LATE', id: crypto.randomUUID() });
      await expect(
        signals.enqueue({
          id: late.id,
          threadKey,
          runId: stream.runId,
          scope: 'pending',
          signal: toStoredSignalPayload(late),
        }),
      ).resolves.toBe('run-closed');
    },
  );
});

/** Observed signal storage that every process reads and writes, as a database is. */
class SharedObservedSignals extends ObservedSignals {
  override get sharedAcrossProcesses(): boolean {
    return true;
  }
}

/**
 * A sender standing in for another process: its own thread runtime, on the
 * thread pubsub of the agent that holds the run, sending as the same agent
 * on a Mastra host whose storage shares the run's signal storage, unless
 * given its own.
 */
async function remoteSender(owner: ReturnType<typeof setup>, signals: InMemoryAgentSignalsStorage = owner.signals) {
  const storage = new InMemoryStore();
  storage.stores.agentSignals = signals;
  const agent = createEventedAgent({
    agent: new Agent({
      id: 'stored-signals',
      name: 'stored-signals',
      instructions: 'Test',
      model: new MockLanguageModelV2({}),
      memory: new MockMemory({ storage }),
    }),
    pubsub: new EventEmitterPubSub(),
  });
  new Mastra({ agents: { owner: agent }, storage, logger: false });
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = owner.agent.getPubSub()!;
  const subscription = await runtime.subscribeToThread(agent, owner.scope, pubsub);
  const runs = subscription.stream[Symbol.asyncIterator]();
  return {
    send: (contents: string, id?: string) =>
      runtime.sendSignal(agent, { type: 'user', contents, ...(id ? { id } : {}) }, owner.scope, pubsub),
    /** Resolves once this runtime sees the owner's run. */
    seesRun: () => runs.next(),
    unsubscribe: () => subscription.unsubscribe(),
  };
}

type EnqueuedEvent = { type: 'signal-enqueued'; runId: string; signal: { id: string }; stored?: boolean };

/** Keeps every `signal-enqueued` event published on the owner's thread. */
async function recordEnqueued(owner: ReturnType<typeof setup>) {
  const enqueued: EnqueuedEvent[] = [];
  await owner.agent
    .getPubSub()!
    .subscribe(agentThreadStreamTopic(owner.scope.resourceId, owner.scope.threadId), event => {
      const data = event.data as { type?: string } | undefined;
      if (data?.type === 'signal-enqueued') enqueued.push(data as EnqueuedEvent);
    });
  return enqueued;
}

/** A model that answers once, for agents that only send. */
const senderModel = () =>
  new MockLanguageModelV2({
    doStream: async () => ({
      warnings: [],
      stream: convertArrayToReadableStream<LanguageModelV2StreamPart>([
        { type: 'stream-start', warnings: [] },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });

describe('signals another agent forwards to a run held in another process', () => {
  // A send of one agent to an active run of another is refused (`thread-blocked`). It is forwarded when the
  // sender sees the thread idle, wakes it, and loses the thread lease to that run.
  it('stores a signal from an agent that keeps its signals in memory, and the run reads it once', async () => {
    const signals = new ObservedSignals();
    const owner = setup({ signals });
    const enqueued = await recordEnqueued(owner);
    const sender = new Agent({ id: 'map-sender', name: 'map-sender', instructions: 'Test', model: senderModel() });
    const { stream, done } = await owner.start();
    const sent = new AgentThreadStreamRuntime().sendSignal(
      sender,
      { type: 'user', contents: 'FROM_MAP_AGENT' },
      owner.scope,
      owner.agent.getPubSub(),
    );
    await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    owner.toolGate.release();
    await done;

    const events = enqueued.filter(event => event.signal.id === sent.signal.id);
    expect(events.map(event => ({ runId: event.runId, stored: event.stored ?? false }))).toEqual([
      { runId: stream.runId, stored: false },
    ]);
    // The runtime holding the run stored it.
    expect(signals.calls.filter(call => call.op === 'enqueue' && call.id === sent.signal.id)).toEqual([
      { op: 'enqueue', id: sent.signal.id, runId: stream.runId },
    ]);
    expect(owner.prompts).toHaveLength(2);
    expect(occurrences(owner.prompts[1], 'FROM_MAP_AGENT')).toBe(1);
  });

  it('keeps in memory a signal that an agent storing its signals sends to a run that keeps them there', async () => {
    const owner = setup();
    owner.mastra.getStorage()!.stores.agentSignals = undefined;
    const enqueued = await recordEnqueued(owner);
    const senderSignals = new ObservedSignals();
    const senderStorage = new InMemoryStore();
    senderStorage.stores.agentSignals = senderSignals;
    const sender = createEventedAgent({
      agent: new Agent({ id: 'stored-sender', name: 'stored-sender', instructions: 'Test', model: senderModel() }),
      pubsub: new EventEmitterPubSub(),
    });
    new Mastra({ agents: { sender }, storage: senderStorage, logger: false });
    const { stream, done } = await owner.start();
    const sent = new AgentThreadStreamRuntime().sendSignal(
      sender,
      { type: 'user', contents: 'FROM_STORED_AGENT' },
      owner.scope,
      owner.agent.getPubSub(),
    );
    await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
    owner.toolGate.release();
    await done;

    const events = enqueued.filter(event => event.signal.id === sent.signal.id);
    expect(events.map(event => ({ runId: event.runId, stored: event.stored ?? false }))).toEqual([
      { runId: stream.runId, stored: false },
    ]);
    expect(senderSignals.calls.filter(call => call.op === 'enqueue')).toEqual([]);
    expect(owner.prompts).toHaveLength(2);
    expect(occurrences(owner.prompts[1], 'FROM_STORED_AGENT')).toBe(1);
    expect(await senderSignals.listPending({ threadKey: owner.threadKey })).toEqual([]);
  });
});

describe('signals sent to a run held in another process', () => {
  it('does not deliver a retry of a consumed signal from the same process again', async () => {
    const signals = new SharedObservedSignals();
    const owner = setup({ signals });
    const sender = await remoteSender(owner);
    try {
      const seen = sender.seesRun();
      const { stream, done } = await owner.start();
      await seen;
      const first = sender.send('RETRIED_SEND');
      await expect(first.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
      // Retried after the run's last drain deleted the row, and before its close, as a caller whose answer was
      // lost does. A new row there would be left to the thread's next turn.
      let retry: ReturnType<typeof sender.send> | undefined;
      signals.beforeClose = async ({ runId }) => {
        expect(signals.calls).toContainEqual({ op: 'delete', ids: [first.signal.id] });
        retry = sender.send('RETRIED_SEND', first.signal.id);
        await expect(retry.accepted).resolves.toEqual({ action: 'deliver', runId });
      };
      const followUpsDone = owner.afterFollowUps();
      owner.toolGate.release();
      await done;
      await followUpsDone;

      expect(retry).toBeDefined();
      const turns = owner.prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
      expect(turns).toHaveLength(2);
      expect(occurrences(turns[1], 'RETRIED_SEND')).toBe(1);
      expect(signals.calls.filter(call => call.op === 'enqueue' && call.id === first.signal.id)).toHaveLength(1);
    } finally {
      sender.unsubscribe();
    }
  });

  // During a rolling deploy the run's holder may be a release that keeps forwarded signals in memory; a row stored
  // for it as well would reach the thread's next run a second time.
  it('leaves a signal to a holder that never said it stores signals, and stores nothing itself', async () => {
    const owner = setup();
    // The holder keeps the run's signals in memory, so its registration does not say it stores them.
    owner.mastra.getStorage()!.stores.agentSignals = undefined;
    const enqueued = await recordEnqueued(owner);
    const senderSignals = new SharedObservedSignals();
    const sender = await remoteSender(owner, senderSignals);
    try {
      const seen = sender.seesRun();
      const { stream, done } = await owner.start();
      await seen;
      const sent = sender.send('TO_MEMORY_HOLDER');
      await expect(sent.accepted).resolves.toEqual({ action: 'deliver', runId: stream.runId });
      owner.toolGate.release();
      await done;

      const events = enqueued.filter(event => event.signal.id === sent.signal.id);
      expect(events.map(event => ({ runId: event.runId, stored: event.stored ?? false }))).toEqual([
        { runId: stream.runId, stored: false },
      ]);
      expect(senderSignals.calls.filter(call => call.op === 'enqueue')).toEqual([]);
      expect(owner.prompts).toHaveLength(2);
      expect(occurrences(owner.prompts[1], 'TO_MEMORY_HOLDER')).toBe(1);
    } finally {
      sender.unsubscribe();
    }
  });

  it('never delivers a stored signal that a process keeping its signals in memory cancelled', async () => {
    const signals = new SharedObservedSignals();
    const owner = setup({ signals });
    const { done } = await owner.start();
    const sent = owner.agent.sendSignal({ type: 'user', contents: 'CANCELLED_ELSEWHERE' }, owner.scope);
    await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver' });
    const cancelledByHolder = gate();
    signals.afterCancel = ids => {
      if (ids.includes(sent.signal.id)) cancelledByHolder.release();
    };
    // Another agent of the thread, in another process, keeps its signals in memory: it only cancels its own
    // queues and announces the cancel.
    const canceller = new Agent({
      id: 'map-canceller',
      name: 'map-canceller',
      instructions: 'Test',
      model: senderModel(),
    });
    new AgentThreadStreamRuntime().cancelQueuedMessages(
      canceller,
      { ...owner.scope, signalIds: [sent.signal.id] },
      owner.agent.getPubSub(),
    );
    await cancelledByHolder.promise;
    owner.toolGate.release();
    await done;

    expect(owner.prompts).toHaveLength(2);
    expect(owner.prompts.some(prompt => occurrences(prompt, 'CANCELLED_ELSEWHERE') > 0)).toBe(false);
    expect(await signals.listPending({ threadKey: owner.threadKey })).toEqual([]);
  });
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
    const signals = new ObservedSignals();
    storage.stores.agentSignals = signals;
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
    expect(signals.calls.filter(call => call.op === 'enqueue' && call.runId === stream.runId)).toHaveLength(1);
  });
});

/** Signal storage whose first `listPending` after `hold()` waits until the test releases it. */
class HeldListSignals extends InMemoryAgentSignalsStorage {
  #held?: { reached: ReturnType<typeof gate>; release: ReturnType<typeof gate> };

  hold() {
    this.#held = { reached: gate(), release: gate() };
    return this.#held;
  }

  override async listPending(args: { threadKey: string; runId?: string | null }) {
    const held = this.#held;
    this.#held = undefined;
    const rows = await super.listPending(args);
    if (held) {
      held.reached.release();
      await held.release.promise;
    }
    return rows;
  }
}

/** Signal storage whose claims take nothing, as a run that never reads its stored signals does. */
class UnclaimedSignals extends InMemoryAgentSignalsStorage {
  override async claim(): Promise<StoredAgentSignal[]> {
    return [];
  }
}

/** Stores a thread leftover directly, as a run that closed without taking it leaves one. */
async function storeLeftover(signals: InMemoryAgentSignalsStorage, threadKey: string, contents: string) {
  const signal = createSignal({ type: 'user', contents, id: crypto.randomUUID() });
  await signals.enqueue({
    id: signal.id,
    threadKey,
    runId: null,
    scope: 'pending',
    signal: toStoredSignalPayload(signal),
  });
  return signal;
}

describe('one decision per stored-signal run', () => {
  it('reads stored signals for an evented agent whose Mastra host does not list it', async () => {
    const { signals, threadKey, prompts, toolGate, start } = setup({ hostOnly: true });
    // Left by an earlier run of the thread; this run's first model request takes it over.
    await storeLeftover(signals, threadKey, 'HOST_ONLY_LEFTOVER');
    const { done } = await start();
    toolGate.release();
    // The run fails after its first model request, for a reason unrelated to signals.
    await done.catch(() => {});

    expect(occurrences(prompts[0], 'HOST_ONLY_LEFTOVER')).toBe(1);
    expect(await signals.listPending({ threadKey })).toEqual([]);
  });

  it('starts at most one follow-up for a stored signal no run claims', async () => {
    const signals = new UnclaimedSignals();
    const { threadKey, prompts, toolGate, start, afterFollowUps } = setup({ signals });
    const { done } = await start();
    await storeLeftover(signals, threadKey, 'NEVER_CLAIMED');
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    await followUpsDone;

    const followUps = prompts.filter(prompt => !textOf(prompt).includes(BARRIER));
    expect(followUps.filter(prompt => occurrences(prompt, 'NEVER_CLAIMED') > 0)).toHaveLength(1);
  });

  it('never delivers a leftover cancelled while the end-of-run check reads it', async () => {
    const signals = new HeldListSignals();
    const { agent, scope, threadKey, prompts, toolGate, start, afterFollowUps } = setup({ signals });
    const { done } = await start();
    const leftover = await storeLeftover(signals, threadKey, 'CANCELLED_DURING_CHECK');
    const held = signals.hold();
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await held.reached.promise;
    const cancelled = agent.cancelQueuedMessages({ ...scope, signalIds: [leftover.id] });
    held.release.release();
    await done;
    await followUpsDone;

    await expect(cancelled.settled).resolves.toEqual({ cancelledSignalIds: [leftover.id] });
    expect(prompts.some(prompt => occurrences(prompt, 'CANCELLED_DURING_CHECK') > 0)).toBe(false);
  });
});

describe('a stored signal written by a newer release', () => {
  // The stored form has a version; this release can't read rows of a later one, which a newer process may.
  it('delivers the other signals and keeps the thread going, and leaves that row stored', async () => {
    const signals = new ObservedSignals();
    const { threadKey, prompts, toolGate, start, afterFollowUps } = setup({ signals });
    const unreadable = createSignal({ type: 'user', contents: 'FROM_A_NEWER_RELEASE', id: crypto.randomUUID() });
    await signals.enqueue({
      id: unreadable.id,
      threadKey,
      runId: null,
      scope: 'pending',
      signal: { ...toStoredSignalPayload(unreadable), version: 2 } as StoredAgentSignalPayload,
    });
    await storeLeftover(signals, threadKey, 'READABLE_LEFTOVER');
    const { stream, done } = await start();
    const followUpsDone = afterFollowUps();
    toolGate.release();
    await done;
    // Reached only once the run's end-of-run check released the thread to the queued work.
    await followUpsDone;

    expect(occurrences(prompts[0], 'READABLE_LEFTOVER')).toBe(1);
    expect(prompts.some(prompt => occurrences(prompt, 'FROM_A_NEWER_RELEASE') > 0)).toBe(false);
    // The run and its end-of-run check started no turn for it.
    expect(prompts.filter(prompt => !textOf(prompt).includes(BARRIER))).toHaveLength(2);
    // Never deleted nor counted as consumed: each run that took it over released it at its close.
    expect(signals.calls.filter(call => call.op === 'delete' && call.ids.includes(unreadable.id))).toEqual([]);
    const closes = signals.calls.filter(call => call.op === 'closeRun' && call.runId === stream.runId);
    expect(closes).toHaveLength(1);
    expect(signals.calls.filter(call => call.op === 'closeRun' && call.consumedIds.includes(unreadable.id))).toEqual(
      [],
    );
  });
});

describe('evented agent on storage without agent signals', () => {
  it('delivers a signal sent during a tool to the next model call, from memory', async () => {
    const { agent, mastra, scope, prompts, toolGate, start } = setup();
    mastra.getStorage()!.stores.agentSignals = undefined;
    const { done } = await start();
    const sent = agent.sendSignal({ type: 'user', contents: 'IN_MEMORY_SEND' }, scope);
    await expect(sent.accepted).resolves.toMatchObject({ action: 'deliver' });
    toolGate.release();
    await done;

    expect(textOf(prompts[1])).toContain('IN_MEMORY_SEND');
    expect(prompts).toHaveLength(2);
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

describe('setup warning for signals of evented agents', () => {
  const host = (signals: InMemoryAgentSignalsStorage | undefined, pubsub = new BrokerLikePubSub()) => {
    const storage = new InMemoryStore();
    storage.stores.agentSignals = signals;
    const mastra = new Mastra({ storage, pubsub });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    return { mastra, warn };
  };

  it('warns once when the pubsub reaches other processes and the storage has no agent signals', () => {
    const { mastra, warn } = host(undefined);
    warnUnsharedAgentSignals(mastra);
    warnUnsharedAgentSignals(mastra);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('the storage has no agentSignals domain');
  });

  it('warns when the storage keeps agent signals per process', () => {
    const { mastra, warn } = host(new InMemoryAgentSignalsStorage());
    warnUnsharedAgentSignals(mastra);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('keeps agent signals in this process only');
  });

  it('warns when an evented agent on such a host runs', async () => {
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'warned',
        name: 'warned',
        instructions: 'Test',
        model: new MockLanguageModelV2({
          doStream: async () => ({
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'answer' },
              { type: 'text-delta', id: 'answer', delta: 'answer' },
              { type: 'text-end', id: 'answer' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]),
          }),
        }),
      }),
    });
    const storage = new InMemoryStore();
    storage.stores.agentSignals = undefined;
    const mastra = new Mastra({ agents: { warned: agent }, storage, pubsub: new BrokerLikePubSub() });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    const stream = await agent.stream('Hello');
    await stream.output.consumeStream();

    expect(
      warn.mock.calls.filter(([message]) => String(message).includes('the storage has no agentSignals domain')),
    ).toHaveLength(1);
  });

  it('stays quiet with shared agent signals or a pubsub inside the process', () => {
    const shared = host(new SharedSignals());
    warnUnsharedAgentSignals(shared.mastra);
    const local = host(undefined, new EventEmitterPubSub());
    warnUnsharedAgentSignals(local.mastra);
    expect(shared.warn).not.toHaveBeenCalled();
    expect(local.warn).not.toHaveBeenCalled();
  });
});
