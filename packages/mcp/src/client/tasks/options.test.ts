import { describe, expect, it } from 'vitest';
import { resolveTasksOptions } from './options';

describe('resolveTasksOptions', () => {
  it('accepts the longest delay a timer can wait', () => {
    expect(resolveTasksOptions('s', { maxWaitMs: 2_147_483_647 })).toEqual({ maxWaitMs: 2_147_483_647 });
  });

  it.each(['maxWaitMs', 'pollIntervalMs'] as const)('rejects a %s longer than a timer can wait', key => {
    expect(() => resolveTasksOptions('s', { [key]: 30 * 86_400_000 })).toThrow(RangeError);
  });

  it.each(['maxWaitMs', 'pollIntervalMs'] as const)('rejects a %s that is not a positive integer', key => {
    expect(() => resolveTasksOptions('s', { [key]: 0 })).toThrow(RangeError);
  });
});
