/**
 * Auto-cleanup subscription leak (issue #24070).
 *
 * `DurableAgent.stream()`/`resume()`/`recover()` subscribe a reader to the
 * per-run `agent.stream.<runId>` pubsub topic. When the stream ends they arm a
 * ~30s auto-cleanup timer that tears down the run registry and deletes the
 * pubsub topic. The bug: that timer deleted the topic WITHOUT calling
 * `streamCleanup()`, so the reader's subscription (a pubsub callback / client
 * connection) was never unsubscribed — one leaked subscription per run for the
 * lifetime of the process.
 *
 * Contract locked in here: after the auto-cleanup timer fires, the reader has
 * been unsubscribed from `agent.stream.<runId>` (via `streamCleanup`), and the
 * explicit `cleanup()` remains a harmless no-op afterwards. This mirrors the
 * already-correct `observe()` cleanup path.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent } from '../durable-agent';

function createTextStreamModel(text: string): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

const CLEANUP_MS = 50;

function createSetup(pubsub: EventEmitterPubSub): { agent: DurableAgent; storage: InMemoryStore } {
  const baseAgent = new Agent({
    id: 'stream-cleanup-agent',
    name: 'Stream Cleanup Agent',
    instructions: 'You are a helpful assistant',
    model: createTextStreamModel('Hello!'),
  });
  const storage = new InMemoryStore();
  // Small cleanupTimeoutMs so the auto-cleanup timer fires within the test.
  const agent = createDurableAgent({ agent: baseAgent, pubsub, cleanupTimeoutMs: CLEANUP_MS });
  void new Mastra({
    agents: { 'stream-cleanup-agent': agent as any },
    logger: false,
    storage,
  });
  return { agent: agent as DurableAgent, storage };
}

describe('DurableAgent auto-cleanup unsubscribes the stream reader (issue #24070)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('stream(): auto-cleanup timer unsubscribes from agent.stream.<runId>', async () => {
    const { agent } = createSetup(pubsub);
    // Spy on the CachingPubSub the run reader actually subscribes/unsubscribes on.
    const unsubscribeSpy = vi.spyOn(agent.pubsub, 'unsubscribe');

    const { runId, output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();

    const topic = AGENT_STREAM_TOPIC(runId);

    // The auto-cleanup timer (armed on stream finish) must unsubscribe the
    // reader. Before the fix it never did — the topic was deleted while the
    // subscription lingered for the process lifetime.
    await vi.waitFor(
      () => {
        expect(unsubscribeSpy).toHaveBeenCalledWith(topic, expect.any(Function));
      },
      { timeout: CLEANUP_MS * 40 },
    );

    // Explicit cleanup after the timer is a harmless no-op (idempotent).
    const callsAfterTimer = unsubscribeSpy.mock.calls.length;
    cleanup();
    expect(unsubscribeSpy.mock.calls.length).toBe(callsAfterTimer);
  });

  it('resume(): auto-cleanup timer unsubscribes from agent.stream.<runId>', async () => {
    const { agent } = createSetup(pubsub);
    const unsubscribeSpy = vi.spyOn(agent.pubsub, 'unsubscribe');

    // prepare() builds a suspended run without executing; resume() runs it to
    // completion, arming resume()'s own auto-cleanup timer — the path that
    // previously leaked the reader subscription just like stream().
    const { runId } = await agent.prepare('Start something');
    const { output, cleanup } = await agent.resume(runId, { approved: true });
    await output.consumeStream();

    const topic = AGENT_STREAM_TOPIC(runId);

    await vi.waitFor(
      () => {
        expect(unsubscribeSpy).toHaveBeenCalledWith(topic, expect.any(Function));
      },
      { timeout: CLEANUP_MS * 40 },
    );

    // Explicit cleanup after the timer is a harmless no-op (idempotent).
    const callsAfterTimer = unsubscribeSpy.mock.calls.length;
    cleanup();
    expect(unsubscribeSpy.mock.calls.length).toBe(callsAfterTimer);
  });

  it('explicit cleanup() unsubscribes the stream reader immediately', async () => {
    const { agent } = createSetup(pubsub);
    const unsubscribeSpy = vi.spyOn(agent.pubsub, 'unsubscribe');

    const { runId, output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();

    cleanup();

    const topic = AGENT_STREAM_TOPIC(runId);
    await vi.waitFor(() => {
      expect(unsubscribeSpy).toHaveBeenCalledWith(topic, expect.any(Function));
    });
  });
});
