import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveAutoModelId } from '../auto-model';

describe('resolveAutoModelId', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('picks the low-cost model for the main provider', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    expect(resolveAutoModelId('anthropic/claude-opus-4-6')).toBe('anthropic/claude-haiku-4-5');
    expect(resolveAutoModelId('openai-codex/gpt-5.5')).toBe('openai/gpt-5.4-mini');
    expect(resolveAutoModelId('google/gemini-3.1-pro-preview')).toBe('google/gemini-2.5-flash');
  });

  it('keeps the mastra gateway prefix', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    expect(resolveAutoModelId('mastra/openai/gpt-5.5')).toBe('mastra/openai/gpt-5.4-mini');
  });

  it('returns the main model for providers without a low-cost pick', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    expect(resolveAutoModelId('custom-provider/custom-model')).toBe('custom-provider/custom-model');
    expect(resolveAutoModelId(undefined)).toBeUndefined();
  });

  it('prefers Gemini when the Google key is set', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'test-key');
    expect(resolveAutoModelId('openai/gpt-5.5')).toBe('google/gemini-2.5-flash');
    expect(resolveAutoModelId(undefined)).toBe('google/gemini-2.5-flash');
  });

  it('applies overrides', () => {
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '');
    const autoModels = { google: 'google/gemini-3.5-flash' };
    expect(resolveAutoModelId('google/gemini-3.1-pro-preview', { autoModels })).toBe('google/gemini-3.5-flash');
    expect(resolveAutoModelId('mastra/google/gemini-3.1-pro-preview', { autoModels })).toBe(
      'mastra/google/gemini-3.5-flash',
    );
  });
});
