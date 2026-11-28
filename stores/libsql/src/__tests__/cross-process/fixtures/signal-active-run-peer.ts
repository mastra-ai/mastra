/**
 * Worker for xproc-signal-active-run.test.ts and xproc-signal-failed-run.test.ts:
 * executes the evented agent's steps for runs another process starts. The step
 * tool parks until the test sends `release`, and every model call's prompt is
 * reported to the test.
 */
import { createEventedAgent } from '@mastra/core/agent/durable';
import type { EventCallback, UnixSocketPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';

import { LibSQLStore } from '../../../storage';
import { runPeer } from '../peer-runtime';
import { bootWorkers } from '../process-workers';
import { createStepAgent, gate } from '../step-agent';

export interface SignalActiveRunPeerArgs {
  agentId: string;
  /**
   * The first model call thinks until it is cut short or the test sends `release-reasoning`, instead of calling the
   * tool. The worker reports `hint-handled` each time its control subscription finished handling a
   * `signal-available` event, and `reasoning-ended` with how that call ended.
   */
  reasoning?: boolean;
  /**
   * Fail this run here after its second model call: that call answers only once
   * the test sends `answer`, and every write of a step result that holds its
   * answer fails, as with a workflows store that lost its database for good.
   * The worker drops `signal-available` events, as when a hint is lost: a hint
   * would cut the held call short and the run's next call would take the
   * signal the test sends while the call is held.
   */
  failRunId?: string;
  /** The agent's memory uses this database instead of the Mastra instance's storage. */
  memoryDbUrl?: string;
}

export interface ModelCallReport {
  pid: number;
  call: number;
  prompt: unknown;
}

const FINAL_TEXT = 'worker answered';

/** Fails the workflows store's step result writes of `runId` that hold `text`. Other writes go through. */
async function failStepResultWrites(storage: LibSQLStore, runId: string, text: string) {
  const workflows = (await storage.getStore('workflows'))!;
  const fails = (args: { runId: string }) => args.runId === runId && JSON.stringify(args).includes(text);
  const updateWorkflowResults = workflows.updateWorkflowResults.bind(workflows);
  workflows.updateWorkflowResults = async args => {
    if (fails(args)) throw new Error(`The workflows store refused a step result of run ${runId}`);
    return updateWorkflowResults(args);
  };
  const appendWorkflowRunEntries = workflows.appendWorkflowRunEntries.bind(workflows);
  workflows.appendWorkflowRunEntries = async args => {
    if (fails(args)) throw new Error(`The workflows store refused a step result of run ${runId}`);
    return appendWorkflowRunEntries(args);
  };
}

/** Calls `onHandled` each time a control-topic subscriber of `pubsub` finished handling a `signal-available` event. */
function reportHandledHints(pubsub: UnixSocketPubSub, onHandled: (signalId: string) => void) {
  const wrappers = new Map<EventCallback, EventCallback>();
  const subscribe = pubsub.subscribe.bind(pubsub);
  const unsubscribe = pubsub.unsubscribe.bind(pubsub);
  pubsub.subscribe = async (topic, cb, options) => {
    if (!topic.startsWith('agent.control.')) return subscribe(topic, cb, options);
    const wrapped: EventCallback = async (event, ack, nack) => {
      try {
        await cb(event, ack, nack);
      } finally {
        const signalId = (event.data as { signalId?: unknown } | undefined)?.signalId;
        if (event.type === 'signal-available' && typeof signalId === 'string') onHandled(signalId);
      }
    };
    wrappers.set(cb, wrapped);
    return subscribe(topic, wrapped, options);
  };
  pubsub.unsubscribe = async (topic, cb) => {
    const wrapped = wrappers.get(cb);
    wrappers.delete(cb);
    return unsubscribe(topic, wrapped ?? cb);
  };
}

/** Acknowledges `signal-available` events on `pubsub`'s control topics without handing them to their subscribers. */
function dropHints(pubsub: UnixSocketPubSub) {
  const wrappers = new Map<EventCallback, EventCallback>();
  const subscribe = pubsub.subscribe.bind(pubsub);
  const unsubscribe = pubsub.unsubscribe.bind(pubsub);
  pubsub.subscribe = async (topic, cb, options) => {
    if (!topic.startsWith('agent.control.')) return subscribe(topic, cb, options);
    const wrapped: EventCallback = async (event, ack, nack, extend) => {
      if (event.type === 'signal-available') return ack?.();
      return cb(event, ack, nack, extend);
    };
    wrappers.set(cb, wrapped);
    return subscribe(topic, wrapped, options);
  };
  pubsub.unsubscribe = async (topic, cb) => {
    const wrapped = wrappers.get(cb);
    wrappers.delete(cb);
    return unsubscribe(topic, wrapped ?? cb);
  };
}

runPeer<SignalActiveRunPeerArgs>(async peer => {
  const { agentId, reasoning = false, failRunId, memoryDbUrl } = peer.args;
  const storage = new LibSQLStore({ id: `signal-active-run-worker-${process.pid}`, url: peer.dbUrl });
  const memoryStorage = memoryDbUrl
    ? new LibSQLStore({ id: `signal-active-run-worker-memory-${process.pid}`, url: memoryDbUrl })
    : storage;
  if (failRunId) await failStepResultWrites(storage, failRunId, FINAL_TEXT);
  const release = gate();
  const answer = gate();
  // Installed before the tool can report that it parked: the test may release at once.
  // A release that never comes leaves the tool parked; the test's own hang guard reports it.
  void peer.waitFor('release').then(
    () => release.resolve(),
    () => {},
  );
  if (failRunId) {
    void peer.waitFor('answer').then(
      () => answer.resolve(),
      () => {},
    );
  }
  const memory = new MockMemory();
  memory.setStorage(memoryStorage);
  const { agent } = createStepAgent({
    id: agentId,
    steps: reasoning ? 0 : 1,
    blockAt: 1,
    release: release.promise,
    finalText: FINAL_TEXT,
    memory,
    onToolEvent: event => {
      if (event.event === 'reached') void peer.signal('tool-reached', { pid: process.pid });
    },
    ...(reasoning
      ? {
          reasoningAt: 1,
          releaseReasoning: peer.waitFor('release-reasoning').then(
            () => {},
            () => new Promise<void>(() => {}),
          ),
          onReasoning: ({ state }: { state: 'reached' | 'cut-short' | 'answered' }) => {
            if (state === 'reached') void peer.signal('reasoning-reached', { pid: process.pid });
            else void peer.signal('reasoning-ended', { pid: process.pid, state });
          },
        }
      : {}),
    onModelPrompt: (call, prompt) => {
      void peer.signal(`model-call-${call}`, { pid: process.pid, call, prompt } satisfies ModelCallReport);
    },
    holdModelCall: call => (failRunId && call === 2 ? answer.promise : undefined),
  });
  const runner = createEventedAgent({ agent });
  const pubsub = peer.pubsub();
  if (reasoning) reportHandledHints(pubsub, signalId => void peer.signal('hint-handled', { signalId }));
  if (failRunId) dropHints(pubsub);
  const mastra = new Mastra({
    agents: { [agentId]: runner },
    storage,
    pubsub,
    logger: false,
    workers: peer.workers ? undefined : false,
  });
  try {
    await bootWorkers(mastra, peer.workers);
    await peer.signal('worker-ready');
    await peer.waitFor('finish', { timeoutMs: 120_000 });
  } finally {
    await mastra.shutdown();
    await storage.close();
    if (memoryStorage !== storage) await memoryStorage.close();
  }
});
