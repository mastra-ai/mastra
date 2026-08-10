import { describe, expect, it } from 'vitest';

import { defaultOptionsSchema } from './default-options';

describe('defaultOptionsSchema toolCallConcurrency', () => {
  it('accepts a numeric concurrency limit', () => {
    expect(defaultOptionsSchema.safeParse({ toolCallConcurrency: 8 }).success).toBe(true);
  });

  it('accepts concurrency options', () => {
    expect(
      defaultOptionsSchema.safeParse({
        toolCallConcurrency: { limit: 8, strategy: 'called' },
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown concurrency strategy', () => {
    expect(
      defaultOptionsSchema.safeParse({
        toolCallConcurrency: { limit: 8, strategy: 'unknown' },
      }).success,
    ).toBe(false);
  });
});
