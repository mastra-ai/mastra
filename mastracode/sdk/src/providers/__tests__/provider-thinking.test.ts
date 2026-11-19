import { describe, expect, it } from 'vitest';

import { providerThinkingOptions } from '../provider-thinking.js';

describe('providerThinkingOptions for Snowflake Cortex', () => {
  it('sends the reasoning effort for a Cortex OpenAI model', () => {
    expect(providerThinkingOptions('snowflake-cortex/openai-gpt-5', 'high')).toEqual({
      optionsKey: 'snowflake-cortex',
      options: { reasoningEffort: 'high' },
      controlKeys: new Set(['reasoningEffort']),
    });
  });

  it('sends a reasoning effort object for a Cortex Claude model', () => {
    expect(providerThinkingOptions('snowflake-cortex/claude-sonnet-4-5', 'high')).toEqual({
      optionsKey: 'snowflake-cortex',
      options: { reasoning: { effort: 'high' } },
      controlKeys: new Set(['reasoning']),
    });
  });

  it('sends nothing when the level is off', () => {
    expect(providerThinkingOptions('snowflake-cortex/openai-gpt-5', 'off')).toBeUndefined();
  });
});
