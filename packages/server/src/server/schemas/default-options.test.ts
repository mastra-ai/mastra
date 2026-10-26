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

describe('defaultOptionsSchema modelSettings', () => {
  it('keeps maxOutputTokens instead of stripping it', () => {
    const result = defaultOptionsSchema.safeParse({ modelSettings: { maxOutputTokens: 512, temperature: 0.2 } });
    expect(result.success && result.data.modelSettings).toEqual({ maxOutputTokens: 512, temperature: 0.2 });
  });

  it('still accepts the legacy maxTokens key', () => {
    const result = defaultOptionsSchema.safeParse({ modelSettings: { maxTokens: 512 } });
    expect(result.success && result.data.modelSettings).toEqual({ maxTokens: 512 });
  });
});
