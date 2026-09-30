import { describe, expect, it } from 'vitest';
import { createMemoryPersistence, init } from './index.js';

/** Validate externally supplied timer values without starting a workflow or scheduling a real timer. */
function configure(pollIntervalMs?: number) {
  return init({
    workflowSlug: 'options',
    buildId: 'test',
    persistence: createMemoryPersistence(),
    pollIntervalMs,
    transport: { start: async () => 'unused', get: async id => ({ id, status: 'pending' }), cancel: async () => {} },
  });
}

describe('polling timer bounds', () => {
  it.each([NaN, Infinity, -Infinity, 2147483648, Number.MAX_VALUE, 9, -1, 0])(
    'rejects %s before a timer can clamp to 1 ms',
    value => {
      expect(() => configure(value)).toThrow(/pollIntervalMs/);
    },
  );
  it.each([undefined, 10, 10.5, 500, 2147483647])('preserves supported intervals including %s', value => {
    expect(() => configure(value)).not.toThrow();
  });
});
