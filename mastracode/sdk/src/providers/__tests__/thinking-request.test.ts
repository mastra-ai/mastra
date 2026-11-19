import { describe, expect, it } from 'vitest';

import { thinkingRequestFormatFor } from '../thinking-request.js';

describe('thinkingRequestFormatFor', () => {
  it('sends the top-level reasoning effort for Cortex OpenAI models', () => {
    const format = thinkingRequestFormatFor('snowflake-cortex/openai-gpt-5');

    expect(format?.optionsKey).toBe('snowflake-cortex');
    expect(format?.sendEffort?.('high')).toEqual({ reasoningEffort: 'high' });
  });

  it('sends a reasoning effort object for Cortex Claude models', () => {
    const format = thinkingRequestFormatFor('snowflake-cortex/claude-sonnet-4-5');

    expect(format?.optionsKey).toBe('snowflake-cortex');
    expect(format?.sendEffort?.('high')).toEqual({ reasoning: { effort: 'high' } });
    expect(format?.effortsForBudgetCatalog).toEqual(['low', 'medium', 'high']);
  });

  it('leaves the adapter providers to their own middleware', () => {
    expect(thinkingRequestFormatFor('anthropic/claude-sonnet-4-5')).toBeUndefined();
    expect(thinkingRequestFormatFor('openai/gpt-5')).toBeUndefined();
  });

  it('keeps the other OpenAI-compatible providers unchanged', () => {
    const format = thinkingRequestFormatFor('xai/grok-4.6');

    expect(format?.optionsKey).toBe('xai');
    expect(format?.sendEffort?.('high')).toEqual({ reasoningEffort: 'high' });
  });

  it('keeps gateway routing ahead of the Cortex family split', () => {
    expect(thinkingRequestFormatFor('mastra/snowflake-cortex/openai-gpt-5')?.optionsKey).toBe('openrouter');
    expect(thinkingRequestFormatFor('mastra/snowflake-cortex/claude-sonnet-4-5')?.optionsKey).toBe('openrouter');
  });
});
