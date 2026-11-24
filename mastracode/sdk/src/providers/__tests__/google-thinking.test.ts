import { describe, expect, it } from 'vitest';
import { createGoogleThinkingMiddleware, resolveGoogleThinkingConfig } from '../google-thinking.js';

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

describe('resolveGoogleThinkingConfig', () => {
  it('returns undefined for off or unset levels', () => {
    expect(resolveGoogleThinkingConfig('gemini-3-flash', 'off')).toBeUndefined();
    expect(resolveGoogleThinkingConfig('gemini-3-flash', undefined)).toBeUndefined();
  });

  it('uses thinkingLevel for Gemini 3 and clamps xhigh/max to high', () => {
    expect(resolveGoogleThinkingConfig('gemini-3-flash-preview', 'medium')).toEqual({ thinkingLevel: 'medium' });
    expect(resolveGoogleThinkingConfig('gemini-3-flash-preview', 'max')).toEqual({ thinkingLevel: 'high' });
  });

  it('maps Gemini 3 Pro to its supported low|high levels', () => {
    expect(resolveGoogleThinkingConfig('gemini-3-pro-preview', 'low')).toEqual({ thinkingLevel: 'low' });
    expect(resolveGoogleThinkingConfig('gemini-3-pro-preview', 'medium')).toEqual({ thinkingLevel: 'high' });
  });

  it('keeps medium for Gemini 3.1 Pro', () => {
    expect(resolveGoogleThinkingConfig('gemini-3.1-pro-preview', 'medium')).toEqual({ thinkingLevel: 'medium' });
    expect(resolveGoogleThinkingConfig('gemini-3.1-flash-lite-image', 'low')).toEqual({ thinkingLevel: 'minimal' });
    expect(resolveGoogleThinkingConfig('gemini-3.1-flash-lite-image', 'medium')).toEqual({ thinkingLevel: 'high' });
    expect(resolveGoogleThinkingConfig('gemini-3.1-flash-lite-image', 'max')).toEqual({ thinkingLevel: 'high' });
    expect(resolveGoogleThinkingConfig('gemini-3.1-flash-image-preview', 'low')).toEqual({ thinkingLevel: 'minimal' });
    expect(resolveGoogleThinkingConfig('gemini-3.1-flash-image', 'medium')).toEqual({ thinkingLevel: 'high' });
  });

  it('uses thinkingBudget for Gemini 2.5', () => {
    expect(resolveGoogleThinkingConfig('gemini-2.5-flash', 'low')).toEqual({ thinkingBudget: 1024 });
    expect(resolveGoogleThinkingConfig('gemini-2.5-pro', 'xhigh')).toEqual({ thinkingBudget: 24576 });
  });

  it('omits config for unrecognized model families', () => {
    expect(resolveGoogleThinkingConfig('gemini-2.0-flash', 'high')).toBeUndefined();
    expect(resolveGoogleThinkingConfig('gemma-3-27b-it', 'high')).toBeUndefined();
  });
});

describe('createGoogleThinkingMiddleware', () => {
  it('returns undefined when there is nothing to inject', () => {
    expect(createGoogleThinkingMiddleware('gemini-3-flash', 'off')).toBeUndefined();
    expect(createGoogleThinkingMiddleware('gemini-2.0-flash', 'high')).toBeUndefined();
  });

  it('preserves existing google config and unrelated providers', async () => {
    const result = await transform(createGoogleThinkingMiddleware('gemini-3-flash', 'low')!, {
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

  it('does not override an explicit caller thinkingBudget', async () => {
    const result = await transform(createGoogleThinkingMiddleware('gemini-3-flash', 'high')!, {
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 512 } } },
    });
    expect(result.providerOptions?.google).toEqual({ thinkingConfig: { thinkingBudget: 512 } });
  });

  it('does not override an explicit caller thinkingLevel', async () => {
    const result = await transform(createGoogleThinkingMiddleware('gemini-3-flash', 'high')!, {
      providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
    });
    expect(result.providerOptions?.google).toEqual({ thinkingConfig: { thinkingLevel: 'low' } });
  });
});
