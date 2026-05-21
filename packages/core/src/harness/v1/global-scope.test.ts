import type * as NodeCrypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Harness v1 global scope', () => {
  afterEach(() => {
    vi.doUnmock('node:crypto');
    vi.resetModules();
  });

  it('does not allocate event or owner ids until they are needed', async () => {
    vi.resetModules();
    const randomUUID = vi.fn(() => 'lazy-id');

    vi.doMock('node:crypto', async importOriginal => {
      const actual = await importOriginal<typeof NodeCrypto>();
      return { ...actual, randomUUID };
    });

    const { EventEmitter } = await import('./events');
    const { Harness } = await import('./harness');

    const emitter = new EventEmitter();
    const harness = new Harness({ modes: [] });

    expect(randomUUID).not.toHaveBeenCalled();
    expect(() => new EventEmitter({}, { nextSequence: -1 })).toThrow();
    expect(randomUUID).not.toHaveBeenCalled();

    expect(emitter.epochId).toBe('lazy-id');
    expect(emitter.epochId).toBe('lazy-id');
    expect(randomUUID).toHaveBeenCalledTimes(1);

    expect(harness.ownerId).toBe('harness-lazy-id');
    expect(harness.ownerId).toBe('harness-lazy-id');
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });
});
