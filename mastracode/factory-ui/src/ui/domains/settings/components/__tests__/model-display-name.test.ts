import { describe, expect, it } from 'vitest';

import { formatModelName, modelProvider } from '../model-display-name';

describe('formatModelName', () => {
  it.each([
    ['anthropic/claude-haiku-4-5', 'Claude Haiku 4.5'],
    ['openai/gpt-5.4-mini', 'GPT-5.4 Mini'],
    ['google/gemini-3.5-flash', 'Gemini 3.5 Flash'],
    ['amazon-bedrock/anthropic.claude-sonnet-4-5', 'Claude Sonnet 4.5'],
    ['claude-opus-4-1', 'Claude Opus 4.1'],
  ])('names %s as %s', (id, name) => {
    expect(formatModelName(id)).toBe(name);
  });
});

describe('modelProvider', () => {
  it('reads the provider from a provider/model id', () => {
    expect(modelProvider('openai/gpt-5.4')).toBe('openai');
    expect(modelProvider('gpt-5.4')).toBe('');
  });
});
