/**
 * Observer-only teardown for `DurableAgent.observe()` (issue #25022).
 *
 * Stopping observation — `detach()`, leaving the `for await` loop, or a bare
 * `idleTimeoutMs` — must unsubscribe only this observer. The run's replay
 * history (pubsub topic) must survive so the run can keep going and other
 * observers can still watch or replay it. Only a terminal event, an `isAlive`
 * probe confirming the run is dead, or an explicit `cleanup()` tears it down.
 */

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';
import { emitChunkEvent, emitFinishEvent } from '../stream-adapter';

const CLEANUP_MS = 30;
const IDLE = 30;

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const textChunk = (text: string) => ({ type: 'text-delta', payload: { id: 'text-1', text } }) as any;
const finishData = {
  output: { text: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, steps: [] },
  stepResult: { reason: 'stop' as const, warnings: [], isContinued: false },
} as any;

function within<T>(p: Promise<T>, ms = 1000): Promise<T | 'timeout'> {
  return Promise.race([p, delay(ms).then(() => 'timeout' as const)]);
}

describe('DurableAgent.observe() observer-only teardown (issue #25022)', () => {
  let pubsub: EventEmitterPubSub;
  let agent: DurableAgent;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    const baseAgent = new Agent({
      id: 'observe-detach-agent',
      name: 'Observe Detach Agent',
      instructions: 'test',
      model: new MockLanguageModelV2() as any,
    });
    agent = createDurableAgent({ agent: baseAgent, pubsub, cleanupTimeoutMs: CLEANUP_MS }) as DurableAgent;
    void new Mastra({ agents: { 'observe-detach-agent': agent as any }, logger: false, storage: new InMemoryStore() });
  });

  afterEach(async () => {
    await pubsub.close();
  });

  const spies = (runId: string) => {
    const topic = AGENT_STREAM_TOPIC(runId);
    const unsubscribe = vi.spyOn(agent.pubsub, 'unsubscribe');
    const clearTopic = vi.spyOn(agent.pubsub, 'clearTopic');
    return {
      unsubscribeCount: () => unsubscribe.mock.calls.filter(([t]) => t === topic).length,
      topicCleared: () => clearTopic.mock.calls.some(([t]) => t === topic),
    };
  };

  it('detach() unsubscribes without tearing down the run', async () => {
    const runId = 'detach-run';
    const s = spies(runId);
    const { fullStream, detach } = await agent.observe(runId);
    const it$ = fullStream[Symbol.asyncIterator]();

    const pending = it$.next();
    detach();
    expect(await within(pending)).toEqual({ done: true, value: undefined });
    expect(s.unsubscribeCount()).toBe(1);

    detach();
    await delay(CLEANUP_MS * 3);
    expect(s.unsubscribeCount()).toBe(1);
    expect(s.topicCleared()).toBe(false);
  });

  it('detach() unblocks iterator.return() while next() is pending (reporter repro)', async () => {
    // Per the async-iterator spec, return() queues behind a pending next(), so
    // its cancel can never reach the source on its own — detach() resolves the
    // pending read and lets return() complete.
    const runId = 'return-pending';
    const s = spies(runId);
    const { fullStream, detach } = await agent.observe(runId);
    const it$ = fullStream[Symbol.asyncIterator]();

    const pending = it$.next();
    const returned = it$.return!();
    detach();
    expect(await within(pending)).toEqual({ done: true, value: undefined });
    expect(await within(returned)).toEqual({ done: true, value: undefined });

    expect(s.unsubscribeCount()).toBe(1);
    await delay(CLEANUP_MS * 3);
    expect(s.topicCleared()).toBe(false);
  });

  it('breaking out of for await unsubscribes without tearing down the run', async () => {
    const runId = 'break-loop';
    const s = spies(runId);
    const { fullStream } = await agent.observe(runId);

    const consumed = (async () => {
      for await (const chunk of fullStream) {
        if ((chunk as any).type === 'text-delta') break;
      }
    })();
    await emitChunkEvent(agent.pubsub, runId, textChunk('a'));
    expect(await within(consumed)).toBeUndefined();
    await delay(20);

    expect(s.unsubscribeCount()).toBe(1);
    await delay(CLEANUP_MS * 3);
    expect(s.topicCleared()).toBe(false);
  });

  it('a bare idleTimeoutMs ends the stream but keeps the run', async () => {
    const runId = 'bare-idle';
    const s = spies(runId);
    const onError = vi.fn();
    const { fullStream } = await agent.observe(runId, { idleTimeoutMs: IDLE, onError });

    const chunks: any[] = [];
    const consumed = (async () => {
      for await (const chunk of fullStream) chunks.push(chunk);
    })();
    expect(await within(consumed)).toBeUndefined();

    expect(chunks.some(c => c.type === 'error')).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(s.unsubscribeCount()).toBe(1);
    await delay(CLEANUP_MS * 3);
    expect(s.topicCleared()).toBe(false);
  });

  it('idleTimeoutMs + isAlive reporting dead still schedules full cleanup', async () => {
    const runId = 'dead-idle';
    const s = spies(runId);
    const { fullStream } = await agent.observe(runId, { idleTimeoutMs: IDLE, isAlive: () => false });

    const consumed = (async () => {
      for await (const _ of fullStream) {
        // drain
      }
    })();
    expect(await within(consumed)).toBeUndefined();
    await vi.waitFor(() => expect(s.topicCleared()).toBe(true), { timeout: 1000 });
  });

  it('a FINISH event still schedules cleanup, and cleanup() is still full teardown', async () => {
    const finishRun = 'finish-run';
    const f = spies(finishRun);
    const { fullStream } = await agent.observe(finishRun);
    const consumed = (async () => {
      for await (const _ of fullStream) {
        // drain
      }
    })();
    await emitFinishEvent(agent.pubsub, finishRun, finishData);
    await within(consumed);
    await vi.waitFor(() => expect(f.topicCleared()).toBe(true), { timeout: 1000 });

    const cleanupRun = 'cleanup-run';
    const c = spies(cleanupRun);
    const { cleanup } = await agent.observe(cleanupRun);
    cleanup();
    expect(c.topicCleared()).toBe(true);
  });

  it('unsubscribes when the stream ends on its own, even with auto-cleanup disabled', async () => {
    const noCleanup = createDurableAgent({
      agent: new Agent({
        id: 'no-cleanup',
        name: 'No Cleanup',
        instructions: 'test',
        model: new MockLanguageModelV2() as any,
      }),
      pubsub,
      cleanupTimeoutMs: 0,
    }) as DurableAgent;
    const runId = 'natural-end';
    const topic = AGENT_STREAM_TOPIC(runId);
    const unsubscribe = vi.spyOn(noCleanup.pubsub, 'unsubscribe');
    const { fullStream } = await noCleanup.observe(runId);
    const consumed = (async () => {
      for await (const _ of fullStream) {
        // drain
      }
    })();
    await emitFinishEvent(noCleanup.pubsub, runId, finishData);
    expect(await within(consumed)).toBeUndefined();
    await vi.waitFor(() => expect(unsubscribe.mock.calls.some(([t]) => t === topic)).toBe(true), { timeout: 1000 });
  });

  it('one observer detaching does not affect another observer or replay', async () => {
    const runId = 'multi-observer';
    const s = spies(runId);
    const first = await agent.observe(runId);
    const second = await agent.observe(runId);

    const received: string[] = [];
    const secondDone = (async () => {
      for await (const chunk of second.fullStream) {
        if ((chunk as any).type === 'text-delta') received.push((chunk as any).payload.text);
      }
    })();

    await emitChunkEvent(agent.pubsub, runId, textChunk('a'));
    first.detach();
    await emitChunkEvent(agent.pubsub, runId, textChunk('b'));
    await delay(20);
    expect(received).toEqual(['a', 'b']);
    expect(s.topicCleared()).toBe(false);

    const replayed: string[] = [];
    const third = await agent.observe(runId, { offset: 0 });
    const thirdDone = (async () => {
      for await (const chunk of third.fullStream) {
        if ((chunk as any).type === 'text-delta') replayed.push((chunk as any).payload.text);
      }
    })();
    await delay(20);
    expect(replayed).toEqual(['a', 'b']);

    second.detach();
    third.detach();
    await within(Promise.all([secondDone, thirdDone]));
  });
});
