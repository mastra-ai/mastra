/**
 * An evented run whose steps execute in a worker process fails there after it
 * consumed one signal, while a second signal sent to it waits. The worker's
 * workflows store refuses the results of the run's second model call, so the
 * step's deliveries run out and the workflow fails without a saved transcript
 * for that turn. The worker's settle closes the run's signals before the
 * failure reaches the process that started it.
 *
 * The user sees: neither message is lost with the failed turn. The thread's
 * next turn answers both, each once, and the failed run takes nothing after
 * it ended.
 */
import { randomUUID } from 'node:crypto';

import { createSignal } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { describe, expect, it } from 'vitest';

import { LibSQLStore } from '../../storage';
import type { ModelCallReport, SignalActiveRunPeerArgs } from './fixtures/signal-active-run-peer';
import { createXprocEnv, DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS } from './peer-helper';
import { createStepAgent } from './step-agent';

const WORKER = new URL('./fixtures/signal-active-run-peer.ts', import.meta.url);
const TAKEN = 'Taken before the failure';
const WAITING = 'Sent while the failing call ran';

/** Text of the prompt's user messages, in order. */
function userTexts(prompt: unknown): string[] {
  return ((prompt ?? []) as Array<{ role: string; content: unknown }>)
    .filter(message => message.role === 'user')
    .map(message => JSON.stringify(message.content));
}

function copies(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe('evented run that fails in the worker process', () => {
  it(
    "gives the signals it never saved to the thread's next turn, each once, and takes nothing after it ended",
    async () => {
      const env = await createXprocEnv({ workers: false });
      const agentId = `signal-failed-run-${randomUUID()}`;
      const scope = { resourceId: `resource-${randomUUID()}`, threadId: `thread-${randomUUID()}` };
      const storage = new LibSQLStore({ id: 'signal-failed-run-starter', url: env.dbUrl });
      // Another connection to the same database, as the test's view of the store.
      const observer = new LibSQLStore({ id: 'signal-failed-run-observer', url: env.dbUrl });
      const memory = new MockMemory();
      memory.setStorage(storage);
      // This process never runs steps (workers are off), so its model is never called.
      const { agent } = createStepAgent({ id: agentId, steps: 1, memory });
      const runner = createEventedAgent({ agent });
      const mastra = new Mastra({
        agents: { [agentId]: runner },
        storage,
        pubsub: env.pubsub(),
        logger: false,
        workers: false,
      });
      const subscription = await runner.subscribeToThread({ ...scope, withRunStatus: true });
      try {
        const view = (await observer.getStore('memory'))!;
        const runId = `signal-failed-run-${randomUUID()}`;
        const peer = await env.spawnPeer(WORKER, { agentId, failRunId: runId } satisfies SignalActiveRunPeerArgs, {
          role: 'signal-failed-run-worker',
          workers: true,
        });
        await peer.waitFor('worker-ready');

        // Run outcomes on the thread, in order: the failed run, then its next turn.
        const statuses: Array<{ runId: string; status: string }> = [];
        const nextTurnEnded = (async () => {
          for await (const chunk of subscription.stream) {
            if (chunk.type !== 'thread-run-status') continue;
            statuses.push({ runId: chunk.runId, status: chunk.payload.status });
            if (chunk.runId !== runId) return;
          }
        })();

        const stream = await runner.stream('Start the job', {
          runId,
          maxSteps: 5,
          memory: { thread: scope.threadId, resource: scope.resourceId },
        });
        const chunks: Array<{ type: string }> = [];
        const consumed = (async () => {
          for await (const chunk of stream.fullStream) chunks.push(chunk);
        })();

        await peer.waitFor('tool-reached', { timeoutMs: DEFAULT_HANG_GUARD_MS });
        const taken = runner.sendSignal({ type: 'user', contents: TAKEN }, scope);
        await expect(taken.accepted).resolves.toEqual({ action: 'deliver', runId });
        peer.send('release');
        // The run took the first signal into the call whose results are never stored.
        const failingCall = await peer.waitFor<ModelCallReport>('model-call-2', { timeoutMs: DEFAULT_HANG_GUARD_MS });
        expect(userTexts(failingCall.prompt).join('\n')).toContain(TAKEN);
        const waiting = runner.sendSignal({ type: 'user', contents: WAITING }, scope);
        await expect(waiting.accepted).resolves.toEqual({ action: 'deliver', runId });
        peer.send('answer');
        await consumed;
        expect(
          chunks.some(chunk => chunk.type === 'error'),
          JSON.stringify(chunks.map(chunk => chunk.type)),
        ).toBe(true);
        // The worker closed the run before it reported the failure, so the thread no longer names it.
        expect(await view.getSignalRun({ threadId: scope.threadId })).not.toBe(runId);

        // Calls run in order on the worker: the run's two calls, any redelivery of the failing one, the next turn.
        const calls: ModelCallReport[] = [failingCall];
        for (let call = 3; !calls.some(report => userTexts(report.prompt).join('\n').includes(WAITING)); call++) {
          calls.push(await peer.waitFor<ModelCallReport>(`model-call-${call}`, { timeoutMs: DEFAULT_HANG_GUARD_MS }));
        }
        await nextTurnEnded;
        const observed = JSON.stringify({
          statuses,
          calls: calls.map(report => ({ call: report.call, users: userTexts(report.prompt) })),
        });
        expect(statuses, observed).toEqual([
          { runId, status: 'failed' },
          { runId: expect.not.stringMatching(runId), status: 'success' },
        ]);
        // The next turn's model gets both signals, each once.
        const nextTurn = userTexts(calls.at(-1)!.prompt).join('\n');
        expect(copies(nextTurn, TAKEN), observed).toBe(1);
        expect(copies(nextTurn, WAITING), observed).toBe(1);

        // The next turn saved both as messages, once each, and nothing waits or stays hidden for the failed run.
        const saved = (await view.listMessages({ threadId: scope.threadId, perPage: false })).messages;
        expect(saved.filter(message => message.id === taken.signal.id)).toHaveLength(1);
        expect(saved.filter(message => message.id === waiting.signal.id)).toHaveLength(1);
        expect(await view.getSignalRun({ threadId: scope.threadId })).toBeNull();
        expect(await view.listPendingSignals({ threadId: scope.threadId })).toEqual([]);
        // A send addressed to the failed run is refused for it.
        const late = createSignal({ type: 'user', contents: 'Sent to the failed run' });
        expect(
          await view.enqueuePendingSignal({
            message: late.toDBMessage({ threadId: scope.threadId, resourceId: scope.resourceId }),
            toRunId: runId,
          }),
        ).toBe('run-closed');

        peer.send('finish');
        await peer.result();
      } finally {
        subscription.unsubscribe();
        await mastra.shutdown();
        await storage.close();
        await observer.close();
        await env.cleanup();
      }
    },
    PEER_TIMEOUT_MS + DEFAULT_HANG_GUARD_MS * 4,
  );
});
