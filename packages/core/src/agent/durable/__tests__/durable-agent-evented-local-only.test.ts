/**
 * Regression: evented durable-agent workflow events must NOT be tagged
 * `localOnly` on the `workflows` / `workflows-finish` topics.
 *
 * `mastra.pubsub` is a Proxy that tags publishes for *internal* workflows
 * with `localOnly: true` so run-scoped default-engine events skip broker
 * fan-out. Evented durable agents also register their loop workflow in the
 * internal registry (so worker-only processes can resolve it) — but their
 * events exist precisely to cross the process boundary. Tagging them
 * `localOnly` strands the run in the publishing process forever when that
 * process runs no workers (`MASTRA_WORKERS=false` API topology): the
 * production symptom was runs hanging until the caller's deadline while a
 * dedicated OrchestrationWorker sat idle on an empty Redis stream.
 *
 * The shared-emitter pubsub used by the other evented tests can't catch this
 * (localOnly still reaches every subscriber in-process), so these tests use a
 * broker facade that honors localOnly semantics: localOnly events are only
 * delivered to the publishing instance's own subscribers.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, afterEach } from 'vitest';
import type { Event, EventCallback } from '../../../events';
import { PubSub } from '../../../events';

type PublishOptions = { localOnly?: boolean };
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

/**
 * Per-"process" facade over a shared broker that honors `localOnly` the way a
 * real distributed pubsub (Redis Streams, unix-socket broker) does: localOnly
 * publishes are delivered ONLY to this facade's own subscribers; everything
 * else fans out to all facades.
 */
class LocalOnlyHonoringFacade extends PubSub {
  #broker: EventEmitterPubSub;
  #local: EventEmitterPubSub;

  constructor(broker: EventEmitterPubSub) {
    super();
    this.#broker = broker;
    this.#local = new EventEmitterPubSub();
  }

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: PublishOptions): Promise<void> {
    if (options?.localOnly) {
      await this.#local.publish(topic, event);
      return;
    }
    await this.#broker.publish(topic, event);
  }

  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    await this.#local.subscribe(topic, cb);
    await this.#broker.subscribe(topic, cb);
  }

  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    await this.#local.unsubscribe(topic, cb);
    await this.#broker.unsubscribe(topic, cb);
  }

  async flush(): Promise<void> {
    await this.#local.flush();
    await this.#broker.flush();
  }

  async close(): Promise<void> {
    await this.#local.close();
  }
}

describe('evented durable agent × localOnly pubsub tagging', () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
    cleanup = undefined;
  });

  it('publishes workflow.start for the evented loop WITHOUT localOnly', async () => {
    const seen: Array<{ topic: string; type: string; localOnly: boolean }> = [];
    class RecordingPubSub extends EventEmitterPubSub {
      override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: PublishOptions) {
        seen.push({ topic, type: event.type, localOnly: !!options?.localOnly });
        return super.publish(topic, event, options);
      }
    }
    const pubsub = new RecordingPubSub();
    const agent = new Agent({
      id: 'local-only-check',
      instructions: 'x',
      model: createTextModel('hi') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent, engine: 'evented' });
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub,
      agents: { [durableAgent.id]: durableAgent as any },
    });
    await mastra.startWorkers();
    cleanup = async () => {
      await mastra.stopWorkers();
      await pubsub.close();
    };

    const { output, cleanup: streamCleanup } = await durableAgent.stream('hi');
    await output.text;
    streamCleanup?.();

    const starts = seen.filter(e => e.topic === 'workflows' && e.type === 'workflow.start');
    expect(starts.length).toBeGreaterThan(0);
    expect(starts.every(e => !e.localOnly)).toBe(true);
    const finishes = seen.filter(e => e.topic === 'workflows-finish');
    expect(finishes.length).toBeGreaterThan(0);
    expect(finishes.every(e => !e.localOnly)).toBe(true);
  });

  it('completes across a localOnly-honoring broker: publisher has no workers, consumer executes', async () => {
    const broker = new EventEmitterPubSub();
    const storage = new MockStore();

    const buildInstance = (side: 'publisher' | 'consumer') => {
      const agent = new Agent({
        id: 'local-only-two-proc',
        instructions: 'x',
        model: createTextModel(`done-by-${side}`) as LanguageModelV2,
      });
      const durableAgent = createDurableAgent({ agent, engine: 'evented' });
      const pubsub = new LocalOnlyHonoringFacade(broker);
      const mastra = new Mastra({
        logger: false,
        storage,
        pubsub,
        agents: { [durableAgent.id]: durableAgent as any },
      });
      return { mastra, durableAgent, pubsub };
    };

    const publisher = buildInstance('publisher');
    const consumer = buildInstance('consumer');
    // Only the consumer runs workers — the md `--workers dedicated` topology.
    await consumer.mastra.startWorkers();
    cleanup = async () => {
      await consumer.mastra.stopWorkers();
      await publisher.pubsub.close();
      await consumer.pubsub.close();
      await broker.close();
    };

    const { output, cleanup: streamCleanup } = await publisher.durableAgent.stream('hi');
    const text = await Promise.race([
      output.text,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('run stranded in publisher — workflow.start never crossed the broker')),
          10_000,
        ),
      ),
    ]);
    streamCleanup?.();

    // Both instances share one JS process, so the in-memory globalRunRegistry
    // lets the executing side resolve the publisher's closures — execution
    // identity is asserted honestly in durable-agent-evented-two-process.
    // The regression signal here is *completion*: pre-fix, workflow.start was
    // tagged localOnly, never crossed the broker, and this raced into the
    // 10s "stranded" rejection.
    expect(text).toMatch(/^done-by-/);
  });
});
