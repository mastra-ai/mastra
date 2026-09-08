import { describe, expect, it, vi } from 'vitest';

import { PubSub } from './pubsub';
import type { EventCallback, SubscribeOptions } from './types';

class TestPubSub extends PubSub {
  readonly subscribeSpy = vi.fn(async (_topic: string, _cb: EventCallback, _options?: SubscribeOptions) => {});
  readonly replaySpy = vi.fn(async (_topic: string, _cb: EventCallback) => {});
  readonly unsupportedOffsetSpy = vi.fn((_offset: number) => {});

  async publish() {}
  subscribe = this.subscribeSpy;
  async unsubscribe() {}
  async flush() {}

  override subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    return this.replaySpy(topic, cb);
  }

  protected override onUnsupportedOffset(offset: number): void {
    this.unsupportedOffsetSpy(offset);
  }
}

describe('PubSub subscription positions', () => {
  it('defaults to not supporting numeric offsets', () => {
    expect(new TestPubSub().supportsOffsets).toBe(false);
  });

  it('passes startFrom through to subscribe implementations', async () => {
    const pubsub = new TestPubSub();
    const cb = vi.fn();
    const options = { startFrom: 'latest' as const };

    await pubsub.subscribe('topic', cb, options);

    expect(pubsub.subscribeSpy).toHaveBeenCalledWith('topic', cb, options);
  });

  it('surfaces unsupported non-zero offsets before falling back to full replay', async () => {
    const pubsub = new TestPubSub();
    const cb = vi.fn();

    await pubsub.subscribeFromOffset('topic', 3, cb);

    expect(pubsub.unsupportedOffsetSpy).toHaveBeenCalledWith(3);
    expect(pubsub.replaySpy).toHaveBeenCalledWith('topic', cb);
  });

  it('does not surface a diagnostic for offset zero', async () => {
    const pubsub = new TestPubSub();

    await pubsub.subscribeFromOffset('topic', 0, vi.fn());

    expect(pubsub.unsupportedOffsetSpy).not.toHaveBeenCalled();
  });
});
