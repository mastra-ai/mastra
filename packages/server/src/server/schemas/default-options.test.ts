import { describe, expect, it } from 'vitest';

import { defaultOptionsSchema } from './default-options';

describe('defaultOptionsSchema toolCallConcurrency', () => {
  it('accepts a numeric concurrency limit', () => {
    expect(defaultOptionsSchema.safeParse({ toolCallConcurrency: 8 }).success).toBe(true);
  });

  it.each([
    ['accepts concurrency options', 'called', true],
    ['rejects an unknown concurrency strategy', 'unknown', false],
  ] as const)('%s', (_title, strategy, expected) => {
    expect(
      defaultOptionsSchema.safeParse({
        toolCallConcurrency: { limit: 8, strategy },
      }).success,
    ).toBe(expected);
  });
});
