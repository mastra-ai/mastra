import { describe, expect, it } from 'vitest';

import { getAvailableModePacks } from '../packs.js';

describe('getAvailableModePacks', () => {
  it('uses GPT-5.5 for OpenAI plan and build modes while keeping fast on GPT-5.4 mini', () => {
    const packs = getAvailableModePacks({
      anthropic: false,
      openai: 'oauth',
      cerebras: false,
      google: false,
      deepseek: false,
    });

    expect(packs.find(pack => pack.id === 'openai')?.models).toEqual({
      plan: 'openai/gpt-5.5',
      build: 'openai/gpt-5.5',
      fast: 'openai/gpt-5.4-mini',
    });
  });
});
