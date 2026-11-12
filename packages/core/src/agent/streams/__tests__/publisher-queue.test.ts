/**
 * Publishing a run's events is a serial queue, so while the cache or transport is
 * unreachable the events the loop produces pile up behind it. The queue is bounded, and a
 * run whose events had to be dropped says so in its log before it can report success.
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import { AGENT_STREAM_PUBLISH_QUEUE_LIMIT } from '../constants';

const REPLAY_INCOMPLETE = 'AGENT_STREAM_REPLAY_INCOMPLETE';

/**
 * Holds everything the run publishes until it is released, the way an unreachable cache
 * does, and keeps the events in the order the publisher sent them.
 */
class HeldPubSub extends EventEmitterPubSub {
  readonly events: Array<{ type: string; errorId?: string }> = [];
  #held: Promise<void> | undefined;
  #release: (() => void) | undefined;
  /** Makes the first attempt to report a gap fail, as a publish that cannot land would. */
  failNextGap = false;

  hold() {
    this.#held = new Promise(resolve => (this.#release = resolve));
  }

  release() {
    this.#release?.();
    this.#held = undefined;
  }

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic.startsWith('agent.stream.')) {
      await this.#held;
      const data = (event as { data?: { error?: { id?: string } } }).data;
      if (data?.error?.id === REPLAY_INCOMPLETE && this.failNextGap) {
        this.failNextGap = false;
        throw new Error('Socket closed unexpectedly');
      }
      this.events.push({ type: event.type, errorId: data?.error?.id });
    }
    return super.publish(topic, event, options);
  }
}

/** A model that streams `deltas` text chunks, so a run produces more frames than the queue holds. */
function makeAgent(deltas: number) {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'queue-resp', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 't-1' },
        ...Array.from({ length: deltas }, (_, index) => ({ type: 'text-delta', id: 't-1', delta: `${index} ` })),
        { type: 'text-end', id: 't-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: deltas, totalTokens: deltas + 1 },
        },
      ] as any),
    }),
  });
  return new Agent({ id: 'queue-agent', name: 'queue-agent', instructions: 'Say a lot.', model });
}

const resource = (id: string) => new RequestContext([[MASTRA_RESOURCE_ID_KEY, id]]);

describe('agent stream publishing queue', () => {
  // The caller keeps its own stream; what is bounded is the copy this process publishes for
  // other readers. Overflowing it must be reported, not silently truncated.
  it('reports an incomplete replay before finishing when the queue overflows', async () => {
    const pubsub = new HeldPubSub();
    const deltas = AGENT_STREAM_PUBLISH_QUEUE_LIMIT + 100;
    const agent = makeAgent(deltas);
    new Mastra({ agents: { agent }, pubsub, logger: false });
    pubsub.hold();

    const stream = await agent.stream('Go.', { requestContext: resource('tenant-a') });
    for await (const _chunk of stream.fullStream) {
      // The caller reads at its own pace; publishing is what is stalled.
    }
    pubsub.release();

    await vi.waitFor(() => expect(pubsub.events.at(-1)?.type).toBe('finish'), { timeout: 10_000 });

    const gap = pubsub.events.findIndex(event => event.errorId === REPLAY_INCOMPLETE);
    const finish = pubsub.events.findIndex(event => event.type === 'finish');
    expect(gap).toBeGreaterThanOrEqual(0);
    // Readers meet the gap before the success terminal, so a short replay cannot pass for
    // the whole run.
    expect(gap).toBeLessThan(finish);
    // Some events were dropped rather than queued: the published chunks are fewer than the
    // chunks the run produced.
    expect(pubsub.events.filter(event => event.type === 'chunk').length).toBeLessThan(deltas);
  }, 30000);

  // The gap notification travels on the same bus as the run, so it can fail too. Then no
  // reader may be told the run succeeded.
  it('fails the run instead of finishing when the gap cannot be reported', async () => {
    const pubsub = new HeldPubSub();
    pubsub.failNextGap = true;
    const agent = makeAgent(AGENT_STREAM_PUBLISH_QUEUE_LIMIT + 100);
    new Mastra({ agents: { agent }, pubsub, logger: false });
    pubsub.hold();

    const stream = await agent.stream('Go.', { requestContext: resource('tenant-a') });
    for await (const _chunk of stream.fullStream) {
      // Drain the caller's stream while publishing is stalled.
    }
    pubsub.release();

    await vi.waitFor(() => expect(pubsub.events.length).toBeGreaterThan(0), { timeout: 10_000 });
    await vi.waitFor(() => expect(pubsub.events.some(event => event.type === 'error')).toBe(true), {
      timeout: 10_000,
    });

    expect(pubsub.events.filter(event => event.type === 'finish')).toEqual([]);
    expect(pubsub.events.at(-1)).toMatchObject({ type: 'error', errorId: REPLAY_INCOMPLETE });
  }, 30000);

  // A run that never falls behind publishes what it always did: no gap, and a finish.
  it('publishes a complete run without reporting a gap', async () => {
    const pubsub = new HeldPubSub();
    const agent = makeAgent(20);
    new Mastra({ agents: { agent }, pubsub, logger: false });

    const stream = await agent.stream('Go.', { requestContext: resource('tenant-a') });
    await stream.consumeStream();

    expect(pubsub.events.some(event => event.errorId === REPLAY_INCOMPLETE)).toBe(false);
    expect(pubsub.events.at(-1)?.type).toBe('finish');
  }, 30000);

  // A reader that was not attached while the run overflowed has to learn that its replay is
  // short. It reads the retained log through observe(), which surfaces the gap as a run
  // failure rather than handing back a truncated transcript that looks whole.
  it('reports the incomplete replay to a reader that attaches afterwards', async () => {
    const pubsub = new HeldPubSub();
    const cache = new InMemoryServerCache();
    const agent = makeAgent(AGENT_STREAM_PUBLISH_QUEUE_LIMIT + 100);
    new Mastra({ agents: { agent }, pubsub, cache, logger: false });
    pubsub.hold();

    const stream = await agent.stream('Go.', { requestContext: resource('tenant-a') });
    for await (const _chunk of stream.fullStream) {
      // Drain the caller's stream while publishing is stalled.
    }
    pubsub.release();
    await vi.waitFor(() => expect(pubsub.events.at(-1)?.type).toBe('finish'), { timeout: 10_000 });

    const observer = await agent.observe(stream.runId!);
    const errors: Array<Error & { id?: string }> = [];
    try {
      for await (const chunk of observer.fullStream as ReadableStream<any>) {
        if (chunk.type === 'error') errors.push(chunk.payload.error);
      }
    } finally {
      observer.detach();
    }

    expect(errors.some(error => error.id === REPLAY_INCOMPLETE)).toBe(true);
  }, 30000);
});
