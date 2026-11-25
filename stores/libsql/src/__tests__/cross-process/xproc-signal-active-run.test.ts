/**
 * A message sent to an evented run whose steps execute in another process.
 * The process that starts the run has workers off; a peer process
 * runs the workers, so the run's tool and model calls happen there. The tool
 * parks until the test releases it, and the test releases it only after the
 * sender's `accepted` promise has resolved.
 *
 * The user sees: the message is acknowledged as delivered to the running run,
 * and the model's next answer in that run takes it into account. It is not
 * answered later in a separate turn, and the thread stores it once.
 *
 * To know that no separate turn followed, the starting process queues a
 * barrier message (`queueMessage`) while the run is still active. Queued
 * messages start only after every follow-up turn of the finished run, so once
 * the barrier's model call arrives, any follow-up turn has already run.
 */
import { randomUUID } from 'node:crypto';

import { createEventedAgent } from '@mastra/core/agent/durable';
import { UnixSocketPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { ModelCallReport, SignalActiveRunPeerArgs } from './fixtures/signal-active-run-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import type { XprocEnv } from './peer-helper';
import { createStepAgent } from './step-agent';

const WORKER = new URL('./fixtures/signal-active-run-peer.ts', import.meta.url);
const BARRIER = 'BARRIER: queued after the run';

async function guarded<T>(promise: Promise<T>, what: string, context: () => string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} did not settle\n${context()}`)), DEFAULT_HANG_GUARD_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function buildApp(env: XprocEnv, agentId: string, role: string, pubsub = env.pubsub()) {
  const storage = new LibSQLStore({ id: `signal-active-run-${role}`, url: env.dbUrl });
  const memory = new MockMemory();
  memory.setStorage(storage);
  // This process never runs steps (workers are off), so its model is never called.
  const { agent } = createStepAgent({ id: agentId, steps: 1, memory });
  const runner = createEventedAgent({ agent });
  const mastra = new Mastra({ agents: { [agentId]: runner }, storage, pubsub, logger: false, workers: false });
  return { storage, runner, mastra };
}

/** Text of the prompt's user messages, in order. */
function userTexts(prompt: unknown): string[] {
  return ((prompt ?? []) as Array<{ role: string; content: unknown }>)
    .filter(message => message.role === 'user')
    .map(message => JSON.stringify(message.content));
}

async function runCase({
  messages,
  sender,
  closeBeforeSend = false,
}: {
  messages: string[];
  sender: 'starter' | 'other-instance';
  /** Close the run's stored signals before sending, as the executing process does right before the run ends. */
  closeBeforeSend?: boolean;
}) {
  const env = await createXprocEnv({ workers: false });
  const agentId = `signal-active-run-${randomUUID()}`;
  const scope = { resourceId: `resource-${randomUUID()}`, threadId: `thread-${randomUUID()}` };
  const starter = buildApp(env, agentId, 'starter');
  let other: ReturnType<typeof buildApp> | undefined;
  let otherPubsub: UnixSocketPubSub | undefined;
  const chunks: Array<{ type: string }> = [];
  try {
    const peer = await env.spawnPeer(WORKER, { agentId } satisfies SignalActiveRunPeerArgs, {
      role: 'signal-active-run-worker',
      workers: true,
    });
    await peer.waitFor('worker-ready');
    if (sender === 'other-instance') {
      // Its own pubsub client gives it its own thread runtime, as a separate process would have.
      otherPubsub = new UnixSocketPubSub(env.socketPath);
      other = buildApp(env, agentId, 'other-instance', otherPubsub);
    }
    const context = () => `${JSON.stringify({ chunks: chunks.map(chunk => chunk.type) })}\n${env.describe()}`;

    // A sender that watched the run start knows the run's agent, so it stores the message itself.
    const observer = closeBeforeSend ? await other?.runner.subscribeToThread(scope) : undefined;
    const observedRun = observer?.stream[Symbol.asyncIterator]().next();
    const runId = `signal-active-run-${randomUUID()}`;
    const stream = await starter.runner.stream('Start the job', {
      runId,
      maxSteps: 5,
      memory: { thread: scope.threadId, resource: scope.resourceId },
    });
    const consumed = (async () => {
      for await (const chunk of stream.fullStream) chunks.push(chunk);
    })();

    await peer.waitFor('tool-reached', { timeoutMs: DEFAULT_HANG_GUARD_MS });
    if (observedRun) await guarded(observedRun, 'the sender seeing the run', context);
    if (closeBeforeSend) {
      // Another connection to the same database, so the run's process learns of the close only from the store.
      const closer = new LibSQLStore({ id: 'signal-active-run-closer', url: env.dbUrl });
      try {
        const memoryStore = await closer.getStore('memory');
        await memoryStore!.closeSignalRun({ threadId: scope.threadId, runId, consumedIds: [] });
      } finally {
        await closer.close();
      }
    }
    const senderRunner = (other ?? starter).runner;
    const sent = messages.map(contents => senderRunner.sendSignal({ type: 'user', contents }, scope));
    const accepted = await guarded(Promise.all(sent.map(result => result.accepted)), 'accepted', context);
    const barrier = starter.runner.queueMessage(BARRIER, scope);
    await guarded(barrier.accepted, 'barrier accepted', context);
    peer.send('release');
    await guarded(consumed, 'the run', context);

    const calls: ModelCallReport[] = [];
    for (let call = 1; !calls.some(report => userTexts(report.prompt).at(-1)?.includes(BARRIER)); call++) {
      calls.push(await peer.waitFor<ModelCallReport>(`model-call-${call}`, { timeoutMs: DEFAULT_HANG_GUARD_MS }));
    }
    const memoryStore = await starter.storage.getStore('memory');
    const stored = (await memoryStore!.listMessages({ threadId: scope.threadId, perPage: false })).messages;

    observer?.unsubscribe();
    peer.send('finish');
    await peer.result();
    return { runId, accepted: accepted.map(stripOutput), calls, stored };
  } finally {
    await other?.mastra.shutdown();
    await other?.storage.close();
    await otherPubsub?.close();
    await starter.mastra.shutdown();
    await starter.storage.close();
    await env.cleanup();
  }
}

function stripOutput(accepted: object) {
  const { output: _output, ...rest } = accepted as { output?: unknown };
  return rest;
}

function expectDeliveredInTheRun(
  { runId, accepted, calls, stored }: Awaited<ReturnType<typeof runCase>>,
  messages: string[],
) {
  const observed = JSON.stringify({
    accepted,
    calls: calls.map(report => ({ call: report.call, users: userTexts(report.prompt) })),
    stored: stored.map(message => ({ id: message.id, role: message.role, content: message.content })),
  });
  for (const result of accepted) expect.soft(result, observed).toEqual({ action: 'deliver', runId });

  // Call 1 asked for the tool; call 2 is the run's model call after the tool.
  const afterTool = userTexts(calls[1]?.prompt).join('\n');
  for (const contents of messages) {
    expect.soft(afterTool.split(contents).length - 1, `copies in the call after the tool: ${observed}`).toBe(1);
  }
  const positions = messages.map(contents => afterTool.indexOf(contents));
  expect
    .soft(
      positions.every(position => position >= 0),
      `call after the tool: ${observed}`,
    )
    .toBe(true);
  expect
    .soft(
      [...positions].sort((a, b) => a - b),
      `send order: ${observed}`,
    )
    .toEqual(positions);

  // Tool call, the answer after it, then the barrier: no turn of its own for the message.
  expect.soft(calls.length, `model calls: ${observed}`).toBe(3);

  for (const contents of messages) {
    const copies = stored.filter(message => JSON.stringify(message.content).includes(contents));
    expect.soft(copies.length, `stored copies of "${contents}": ${observed}`).toBe(1);
  }
}

const TIMEOUT = PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS * 4;

describe('message sent to an evented run whose steps run in another process', () => {
  it(
    'reaches the model call after the running tool, without a turn of its own',
    async () => {
      const messages = ['Also include the pricing table'];
      expectDeliveredInTheRun(await runCase({ messages, sender: 'starter' }), messages);
    },
    TIMEOUT,
  );

  it(
    'keeps two messages sent back to back in send order',
    async () => {
      const messages = ['First: use metric units', 'Second: round to two decimals'];
      expectDeliveredInTheRun(await runCase({ messages, sender: 'starter' }), messages);
    },
    TIMEOUT,
  );

  it(
    'delivers a message sent from another Mastra instance that did not start the run',
    async () => {
      const messages = ['Sent from another instance'];
      expectDeliveredInTheRun(await runCase({ messages, sender: 'other-instance' }), messages);
    },
    TIMEOUT,
  );

  // From another instance, the sender watched the run start, so it stores the message itself and announces it.
  it.each(['starter', 'other-instance'] as const)(
    "cuts short the worker's model request that is still only reasoning, sent from the %s, and its next request has the message",
    async sender => {
      const contents = 'Steer: answer in French';
      const env = await createXprocEnv({ workers: false });
      const agentId = `signal-active-run-${randomUUID()}`;
      const scope = { resourceId: `resource-${randomUUID()}`, threadId: `thread-${randomUUID()}` };
      const starter = buildApp(env, agentId, 'starter');
      let other: ReturnType<typeof buildApp> | undefined;
      let otherPubsub: UnixSocketPubSub | undefined;
      const chunks: Array<{ type: string }> = [];
      try {
        const peer = await env.spawnPeer(WORKER, { agentId, reasoning: true } satisfies SignalActiveRunPeerArgs, {
          role: 'signal-active-run-worker',
          workers: true,
        });
        await peer.waitFor('worker-ready');
        if (sender === 'other-instance') {
          otherPubsub = new UnixSocketPubSub(env.socketPath);
          other = buildApp(env, agentId, 'other-instance', otherPubsub);
        }
        const context = () => `${JSON.stringify({ chunks: chunks.map(chunk => chunk.type) })}\n${env.describe()}`;
        const observer = await other?.runner.subscribeToThread(scope);
        const observedRun = observer?.stream[Symbol.asyncIterator]().next();
        const runId = `signal-active-run-${randomUUID()}`;
        const stream = await starter.runner.stream('Start the job', {
          runId,
          maxSteps: 5,
          memory: { thread: scope.threadId, resource: scope.resourceId },
        });
        const consumed = (async () => {
          for await (const chunk of stream.fullStream) chunks.push(chunk);
        })();
        await peer.waitFor('reasoning-reached', { timeoutMs: DEFAULT_HANG_GUARD_MS });
        if (observedRun) await guarded(observedRun, 'the sender seeing the run', context);
        // Queued while the run is active, so it starts only after every turn the run leaves.
        const barrier = starter.runner.queueMessage(BARRIER, scope);
        await guarded(barrier.accepted, 'barrier accepted', context);

        const sent = (other ?? starter).runner.sendSignal({ type: 'user', contents }, scope);
        const accepted = stripOutput(await guarded(sent.accepted, 'accepted', context));
        await peer.waitFor('reasoning-cut-short', { timeoutMs: DEFAULT_HANG_GUARD_MS });
        await guarded(consumed, 'the run', context);

        const calls: ModelCallReport[] = [];
        for (let call = 1; !calls.some(report => userTexts(report.prompt).at(-1)?.includes(BARRIER)); call++) {
          calls.push(await peer.waitFor<ModelCallReport>(`model-call-${call}`, { timeoutMs: DEFAULT_HANG_GUARD_MS }));
        }
        const memoryStore = await starter.storage.getStore('memory');
        const stored = (await memoryStore!.listMessages({ threadId: scope.threadId, perPage: false })).messages;
        observer?.unsubscribe();
        peer.send('finish');
        await peer.result();

        const observed = JSON.stringify({
          accepted,
          calls: calls.map(report => ({ call: report.call, users: userTexts(report.prompt) })),
          stored: stored.map(message => ({ id: message.id, role: message.role, content: message.content })),
        });
        expect(accepted, observed).toEqual({ action: 'deliver', runId });
        // The request that was cut short, the one asked again with the message, then the barrier.
        expect(calls.length, observed).toBe(3);
        expect(userTexts(calls[0]!.prompt).join('\n').includes(contents), observed).toBe(false);
        expect(userTexts(calls[1]!.prompt).join('\n').split(contents).length - 1, observed).toBe(1);
        expect(stored.filter(message => JSON.stringify(message.content).includes(contents)).length, observed).toBe(1);
      } finally {
        await other?.mastra.shutdown();
        await other?.storage.close();
        await otherPubsub?.close();
        await starter.mastra.shutdown();
        await starter.storage.close();
        await env.cleanup();
      }
    },
    TIMEOUT,
  );

  it(
    'tells another instance the thread is blocked when the run already closed, and starts no turn for it',
    async () => {
      const contents = 'Sent after the run closed';
      const { runId, accepted, calls, stored } = await runCase({
        messages: [contents],
        sender: 'other-instance',
        closeBeforeSend: true,
      });
      const observed = JSON.stringify({
        accepted,
        calls: calls.map(report => ({ call: report.call, users: userTexts(report.prompt) })),
      });
      expect(accepted, observed).toEqual([{ action: 'blocked', reason: 'thread-blocked', runId }]);
      // Tool call, the answer after it, then the barrier.
      expect(calls.length, observed).toBe(3);
      expect(
        calls.some(report => userTexts(report.prompt).some(text => text.includes(contents))),
        observed,
      ).toBe(false);
      expect(stored.filter(message => JSON.stringify(message.content).includes(contents))).toEqual([]);
    },
    TIMEOUT,
  );
});
