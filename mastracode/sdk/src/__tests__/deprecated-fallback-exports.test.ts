import { describe, expect, it } from 'vitest';
import {
  isModelFallbackReason,
  MODEL_FALLBACK_PART_TYPE,
  MODEL_FALLBACK_STATE_KEY,
  modelFallbackNoticeText,
} from '../auth/account-rotation-processor.js';

describe('deprecated fallback exports on @mastra/code-sdk/auth/account-rotation-processor', () => {
  it('still reads and words a saved model fallback', () => {
    const part = {
      type: MODEL_FALLBACK_PART_TYPE,
      data: {
        from: { entryId: 'primary', label: 'anthropic/claude-opus-5.5' },
        to: { entryId: 'fallback', label: 'openai/gpt-5.6-sol' },
        reason: 'pool-exhausted' as const,
        at: '2026-11-24T00:00:00.000Z',
      },
    };

    expect(part.type).toBe('data-mastracode-model-fallback');
    expect(MODEL_FALLBACK_STATE_KEY).toBe('mastracodePendingModelFallback');
    expect(isModelFallbackReason(part.data.reason)).toBe(true);
    expect(isModelFallbackReason('rate-limit')).toBe(false);
    expect(modelFallbackNoticeText(part.data)).toBe('anthropic/claude-opus-5.5 failed, switched to openai/gpt-5.6-sol');
  });
});
