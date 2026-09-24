import { describe, expect, it } from 'vitest';
import { createGoogleThinkingMiddleware, thinkingLevelToGoogleThinkingLevel } from '../google-thinking.js';

type Params = {
  providerOptions?: Record<string, Record<string, unknown>>;
};

async function transform(middleware: NonNullable<ReturnType<typeof createGoogleThinkingMiddleware>>, params: Params) {
  return (await middleware.transformParams!({
    type: 'stream',
    params: params as any,
    model: {} as any,
  })) as Params;
}

describe('thinkingLevelToGoogleThinkingLevel', () => {
  it('maps the session levels onto Google levels', () => {
    expect(thinkingLevelToGoogleThinkingLevel('off')).toBeUndefined();
    expect(thinkingLevelToGoogleThinkingLevel('low')).toBe('low');
    expect(thinkingLevelToGoogleThinkingLevel('medium')).toBe('medium');
    expect(thinkingLevelToGoogleThinkingLevel('high')).toBe('high');
  });

  it('clamps levels above high down to high', () => {
    expect(thinkingLevelToGoogleThinkingLevel('xhigh')).toBe('high');
    expect(thinkingLevelToGoogleThinkingLevel('max')).toBe('high');
  });
});

describe('createGoogleThinkingMiddleware', () => {
  it('returns undefined when the level is off or unset', () => {
    expect(createGoogleThinkingMiddleware('off')).toBeUndefined();
    expect(createGoogleThinkingMiddleware(undefined)).toBeUndefined();
  });

  it('injects thinkingConfig.thinkingLevel under providerOptions.google', async () => {
    const middleware = createGoogleThinkingMiddleware('high');
    expect(middleware).toBeDefined();

    const result = await transform(middleware!, {});
    expect(result.providerOptions?.google).toEqual({
      thinkingConfig: { thinkingLevel: 'high' },
    });
  });

  it('clamps xhigh/max to high on the wire', async () => {
    const result = await transform(createGoogleThinkingMiddleware('max')!, {});
    expect(result.providerOptions?.google).toEqual({
      thinkingConfig: { thinkingLevel: 'high' },
    });
  });

  it('preserves existing google config and unrelated providers', async () => {
    const middleware = createGoogleThinkingMiddleware('low');
    const result = await transform(middleware!, {
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true }, safetySettings: [] as unknown as Record<string, unknown> },
        openai: { store: false },
      },
    });

    expect(result.providerOptions?.google).toMatchObject({
      safetySettings: [],
      thinkingConfig: { includeThoughts: true, thinkingLevel: 'low' },
    });
    expect(result.providerOptions?.openai).toEqual({ store: false });
  });
});
