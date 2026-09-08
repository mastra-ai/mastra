import { describe, expect, it } from 'vitest';
import { ValkeyStreamsPubSub } from './index';

describe('ValkeyStreamsPubSub', () => {
  it('exposes pull delivery semantics', () => {
    const pubsub = new ValkeyStreamsPubSub();
    expect(pubsub.supportedModes).toEqual(['pull']);
    expect(pubsub.supportsOffsets).toBe(false);
  });

  it('rejects invalid stream idle TTL values', () => {
    expect(() => new ValkeyStreamsPubSub({ streamIdleTtlMs: Infinity })).toThrow(
      'streamIdleTtlMs must be a non-negative integer',
    );
  });
});
