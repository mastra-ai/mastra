import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub } from './caching-pubsub';
import { EventEmitterPubSub } from './event-emitter';
import { PubSub } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

/**
 * Minimal transport that records what it was handed and implements nothing
 * beyond `subscribe`, so it exercises the base-class defaults.
 */
class RecordingPubSub extends PubSub {
  lastOptions: SubscribeOptions | undefined;
  replayCalls = 0;

  async publish(): Promise<void> {}

  async subscribe(_topic: string, _cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    this.lastOptions = options;
  }

  async unsubscribe(): Promise<void> {}

  async flush(): Promise<void> {}

  override subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    this.replayCalls += 1;
    return this.subscribe(topic, cb);
  }
}

describe('SubscribeOptions.startFrom', () => {
  it('is passed through to the transport untouched', async () => {
    const pubsub = new RecordingPubSub();
    await pubsub.subscribe('topic', () => {}, { startFrom: 'latest' });
    expect(pubsub.lastOptions?.startFrom).toBe('latest');
  });

  it('is absent when not requested, so existing behaviour is unchanged', async () => {
    const pubsub = new RecordingPubSub();
    await pubsub.subscribe('topic', () => {});
    expect(pubsub.lastOptions?.startFrom).toBeUndefined();
  });
});

describe('PubSub.supportsOffsets', () => {
  it('defaults to false, because the base subscribeFromOffset discards the offset', () => {
    expect(new RecordingPubSub().supportsOffsets).toBe(false);
  });

  it('is true for CachingPubSub, which indexes its own history', () => {
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
    expect(pubsub.supportsOffsets).toBe(true);
  });

  it('CachingPubSub actually honours the offset it advertises', async () => {
    const cache = new InMemoryServerCache();
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);
    const topic = 'offsets';

    for (const n of [1, 2, 3]) {
      await pubsub.publish(topic, { type: 'tick', runId: 'run-1', data: { n } });
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const seen: number[] = [];
    await pubsub.subscribeFromOffset(topic, 2, (event: Event) => {
      seen.push((event.data as { n: number }).n);
      return Promise.resolve();
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Offset 2 skips the first two events rather than replaying everything.
    expect(seen).toEqual([3]);
  });
});

describe('PubSub.subscribeFromOffset on a transport without offset support', () => {
  let pubsub: RecordingPubSub;
  let onUnsupported: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pubsub = new RecordingPubSub();
    onUnsupported = vi.fn();
    // `onUnsupportedOffset` is protected; implementations override it. Patching
    // the instance is how a subclass would surface it through its own logger.
    (pubsub as unknown as { onUnsupportedOffset: unknown }).onUnsupportedOffset = onUnsupported;
  });

  it('still delivers, falling back to full replay', async () => {
    await pubsub.subscribeFromOffset('topic', 42, () => {});
    expect(pubsub.replayCalls).toBe(1);
  });

  it('reports the discarded offset instead of dropping it silently', async () => {
    await pubsub.subscribeFromOffset('topic', 42, () => {});
    expect(onUnsupported).toHaveBeenCalledWith('topic', 42);
  });

  it('stays quiet for offset 0, which full replay satisfies exactly', async () => {
    await pubsub.subscribeFromOffset('topic', 0, () => {});
    expect(onUnsupported).not.toHaveBeenCalled();
    expect(pubsub.replayCalls).toBe(1);
  });

  it('stays quiet when the implementation does support offsets', async () => {
    Object.defineProperty(pubsub, 'supportsOffsets', { get: () => true });
    await pubsub.subscribeFromOffset('topic', 42, () => {});
    expect(onUnsupported).not.toHaveBeenCalled();
  });
});
