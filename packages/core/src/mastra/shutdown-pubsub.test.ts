import { describe, it, expect, vi } from 'vitest';

import { EventEmitterPubSub } from '../events/event-emitter';

import { Mastra } from './index';

describe('Mastra.shutdown() pubsub teardown', () => {
  it('closes a pubsub that holds connections', async () => {
    // Transports like Redis Streams keep sockets open until close(); if
    // shutdown() leaves them, the process never exits on its own.
    const pubsub = Object.assign(new EventEmitterPubSub(), { close: vi.fn(async () => {}) });

    const mastra = new Mastra({ pubsub });
    await mastra.shutdown();

    expect(pubsub.close).toHaveBeenCalledTimes(1);
  });

  it('still finishes shutdown when pubsub close fails', async () => {
    const pubsub = Object.assign(new EventEmitterPubSub(), {
      close: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const mastra = new Mastra({ pubsub });
    await expect(mastra.shutdown()).resolves.toBeUndefined();
  });
});
