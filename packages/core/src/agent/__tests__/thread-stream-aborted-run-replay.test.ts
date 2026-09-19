/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/24174
 *
 * `abortRun` marks the run aborted and publishes `run-aborted`, but it does not
 * remove the run from `activeThreadRunIds` — only terminalization does. When the
 * consumer tears its subscription down in the same tick that it aborts (what
 * `SessionStream.cleanup()` does), no subscriber is left to observe
 * `run-aborted`, so the aborted run stays the thread's active run. The
 * replacement subscription then seeds itself with that run and replays its
 * buffered parts as a brand-new run.
 */
import { describe, expect, it } from 'vitest';

import { EventEmitterPubSub } from '../../events/event-emitter';
import type { MastraModelOutput } from '../../stream/base/output';
import type { Agent } from '../agent';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

const agent = { id: 'aborted-replay-agent' } as unknown as Agent<any, any, any, any>;
const threadId = 'aborted-replay-thread';
const resourceId = 'aborted-replay-user';
const target = { threadId, resourceId };
const memory = { thread: threadId, resource: resourceId };

function nextTicks(count = 5) {
  return Array.from({ length: count }).reduce<Promise<void>>(
    acc => acc.then(() => new Promise(resolve => setTimeout(resolve, 0))),
    Promise.resolve(),
  );
}

/** A run whose stream stays open until the test closes it (a hung run never terminalizes). */
function createFakeRun(runId: string) {
  let streamController!: ReadableStreamDefaultController<unknown>;
  let settle!: () => void;
  let status: 'running' | 'success' = 'running';
  const finished = new Promise<void>(resolve => {
    settle = resolve;
  });

  const output = {
    runId,
    get status() {
      return status;
    },
    fullStream: new ReadableStream<unknown>({
      start(controller) {
        streamController = controller;
      },
    }),
    _waitUntilFinished: () => finished,
  } as unknown as MastraModelOutput<unknown>;

  return {
    output,
    push: (part: unknown) => streamController.enqueue(part),
    finish() {
      status = 'success';
      streamController.close();
      settle();
    },
  };
}

async function startRun(runtime: AgentThreadStreamRuntime, pubsub: EventEmitterPubSub, runId: string) {
  const run = createFakeRun(runId);
  runtime.prepareRunOptions({ runId, memory }, pubsub);
  await runtime.registerRun(agent, run.output, { memory }, pubsub);
  return run;
}

function collect(subscription: { stream: AsyncIterable<unknown> }) {
  const parts: Array<{ type: string; runId?: string }> = [];
  const consumed = (async () => {
    for await (const part of subscription.stream) parts.push(part as { type: string });
  })();
  return { parts, consumed };
}

describe('replacement subscription after an aborted run', () => {
  it('does not replay a run that was aborted and never terminalized', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const run = await startRun(runtime, pubsub, 'hung-run');

    const first = await runtime.subscribeToThread(agent, target, pubsub);
    const firstConsumer = collect(first);
    run.push({ type: 'start', payload: {} });
    run.push({ type: 'text-delta', payload: { id: 't1', text: 'partial' } });
    await nextTicks();
    expect(firstConsumer.parts.map(part => part.type)).toEqual(['start', 'text-delta']);

    // Abort and tear down in the same tick, exactly as SessionStream.cleanup()
    // does: nothing is left subscribed to observe the `run-aborted` event.
    first.abort();
    first.unsubscribe();
    await firstConsumer.consumed;
    await nextTicks();

    // The hung run never terminalizes, so it is still the thread's active run.
    expect(runtime.getActiveThreadRunId(target, pubsub)).toBe('hung-run');

    const replacement = await runtime.subscribeToThread(agent, target, pubsub);
    const replacementConsumer = collect(replacement);
    await nextTicks();

    expect(replacementConsumer.parts).toEqual([]);

    replacement.unsubscribe();
    await replacementConsumer.consumed;
    await pubsub.close();
  });

  it('still streams the next run on the replacement subscription', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const aborted = await startRun(runtime, pubsub, 'hung-run');

    const first = await runtime.subscribeToThread(agent, target, pubsub);
    const firstConsumer = collect(first);
    aborted.push({ type: 'start', payload: {} });
    await nextTicks();
    first.abort();
    first.unsubscribe();
    await firstConsumer.consumed;
    await nextTicks();

    const replacement = await runtime.subscribeToThread(agent, target, pubsub);
    const replacementConsumer = collect(replacement);
    await nextTicks();

    // The follow-up run registers on the same thread and must stream normally.
    const next = await startRun(runtime, pubsub, 'follow-up-run');
    next.push({ type: 'start', payload: {} });
    next.push({ type: 'text-delta', payload: { id: 't2', text: 'follow-up' } });
    await nextTicks();

    expect(replacementConsumer.parts.map(part => part.type)).toEqual(['start', 'text-delta']);
    expect(replacementConsumer.parts.every(part => part.runId === 'follow-up-run')).toBe(true);

    next.finish();
    replacement.unsubscribe();
    await replacementConsumer.consumed;
    await pubsub.close();
  });

  it('does not enqueue the aborted run when a retained backend replays its run-registered', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();

    // Capture the run's `run-registered` event so it can be replayed the way a
    // retained backend (Redis Streams) replays a topic backlog to a fresh
    // subscriber.
    const key = [resourceId, threadId].join('\u0000');
    const topic = `agent.thread-stream.${encodeURIComponent(key)}`;
    let registration: Record<string, unknown> | undefined;
    await pubsub.subscribe(topic, async event => {
      const data = (event as { data?: Record<string, unknown> }).data;
      if (data?.type === 'run-registered') registration = data;
    });

    const run = await startRun(runtime, pubsub, 'hung-run');
    const first = await runtime.subscribeToThread(agent, target, pubsub);
    const firstConsumer = collect(first);
    run.push({ type: 'start', payload: {} });
    await nextTicks();
    expect(registration).toBeDefined();

    first.abort();
    first.unsubscribe();
    await firstConsumer.consumed;
    await nextTicks();

    const replacement = await runtime.subscribeToThread(agent, target, pubsub);
    const replacementConsumer = collect(replacement);
    await pubsub.publish(topic, { type: 'agent.thread-stream', runId: 'hung-run', data: registration });
    await nextTicks();

    expect(replacementConsumer.parts).toEqual([]);

    replacement.unsubscribe();
    await replacementConsumer.consumed;
    await pubsub.close();
  });

  it('still seeds a replacement subscription from a live run that was never aborted', async () => {
    const runtime = new AgentThreadStreamRuntime();
    const pubsub = new EventEmitterPubSub();
    const run = await startRun(runtime, pubsub, 'live-run');

    const first = await runtime.subscribeToThread(agent, target, pubsub);
    const firstConsumer = collect(first);
    run.push({ type: 'start', payload: {} });
    run.push({ type: 'text-delta', payload: { id: 't1', text: 'live' } });
    await nextTicks();
    first.unsubscribe();
    await firstConsumer.consumed;

    const replacement = await runtime.subscribeToThread(agent, target, pubsub);
    const replacementConsumer = collect(replacement);
    await nextTicks();

    expect(replacementConsumer.parts.map(part => part.type)).toEqual(['start', 'text-delta']);

    run.finish();
    replacement.unsubscribe();
    await replacementConsumer.consumed;
    await pubsub.close();
  });
});
