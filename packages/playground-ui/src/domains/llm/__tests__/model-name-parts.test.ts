import { describe, expect, it } from 'vitest';
import { modelNameParts } from '../model-name-parts';

describe('modelNameParts', () => {
  it('puts the provider before the model', () => {
    expect(modelNameParts('gpt-5', 'openai.chat')).toEqual(['openai', 'gpt-5']);
  });

  it('takes the lab from the id when it names one', () => {
    expect(modelNameParts('anthropic/claude-haiku-4-5', 'openrouter')).toEqual(['anthropic', 'claude-haiku-4-5']);
  });

  it('leaves the bare model without a provider', () => {
    expect(modelNameParts('gpt-5', '')).toEqual(['gpt-5']);
  });
});
