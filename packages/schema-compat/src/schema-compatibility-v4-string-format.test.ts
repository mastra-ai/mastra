import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OpenAIReasoningSchemaCompatLayer } from './provider-compats/openai-reasoning';
import type { ModelInformation } from './types';

const modelInfo: ModelInformation = {
  provider: 'openai',
  modelId: 'o3-mini',
  supportsStructuredOutputs: true,
};

describe('defaultZodStringHandler string_format preservation', () => {
  const layer = new OpenAIReasoningSchemaCompatLayer(modelInfo);

  it('keeps datetime validation (a string format the handler does not turn into a description)', () => {
    const result = layer.defaultZodStringHandler(z.string().datetime());

    // Valid datetime still passes.
    expect(result.safeParse('2026-01-01T00:00:00.000Z').success).toBe(true);
    // Invalid datetime must still be rejected: the format check should not be dropped.
    expect(result.safeParse('not-a-datetime').success).toBe(false);
  });

  it('still passes through a plain min_length string', () => {
    const result = layer.defaultZodStringHandler(z.string().min(3));
    expect(result.safeParse('abcd').success).toBe(true);
  });
});
