import { describe, expect, it, vi } from 'vitest';

import { resolveMastraCodeThreadLockConfig } from '../thread-lock-config.js';

describe('resolveMastraCodeThreadLockConfig', () => {
  it('uses file thread locks by default', () => {
    const acquireThreadLock = vi.fn();
    const releaseThreadLock = vi.fn();

    const config = resolveMastraCodeThreadLockConfig({
      crossProcessPubSub: false,
      acquireThreadLock,
      releaseThreadLock,
    });

    expect(config.pubsub).toBeUndefined();
    expect(config.threadLock).toEqual({
      acquire: acquireThreadLock,
      release: releaseThreadLock,
    });
  });

  it('rejects cross-process PubSub mode without a configured PubSub', () => {
    expect(() =>
      resolveMastraCodeThreadLockConfig({
        crossProcessPubSub: true,
        acquireThreadLock: vi.fn(),
        releaseThreadLock: vi.fn(),
      }),
    ).toThrow('crossProcessPubSub requires config.pubsub');
  });

  it('uses configured PubSub instead of file thread locks for cross-process PubSub mode', () => {
    const pubsub = { id: 'shared-pubsub' };

    const config = resolveMastraCodeThreadLockConfig({
      pubsub,
      crossProcessPubSub: true,
      acquireThreadLock: vi.fn(),
      releaseThreadLock: vi.fn(),
    });

    expect(config.pubsub).toBe(pubsub);
    expect(config.threadLock).toBeUndefined();
  });
});
