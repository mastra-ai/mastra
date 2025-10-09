import { openai } from '@ai-sdk/openai-v5';
import { describe, it, expect } from 'vitest';
import { Agent } from '../../agent/index.js';

describe('Provider-executed tools', () => {
  it('should handle OpenAI web search tool execution', async () => {
    const agent = new Agent({
      name: 'test-agent',
      instructions: 'You are a helpful AI assistant with access to web search capabilities.',
      model: openai('gpt-4o-mini'),
      tools: {
        webSearch: openai.tools.webSearch({ searchContextSize: 'low' }),
      },
    });

    const result = await agent.generate('Search for information about the latest AI news from OpenAI in 2024');

    expect(result.toolCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            providerExecuted: true,
            toolName: 'web_search',
            args: {
              action: expect.objectContaining({ query: expect.any(String), type: 'search' }),
            },
          }),
        }),
      ]),
    );
    expect(result.toolResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            providerExecuted: true,
            toolName: 'web_search',
            result: {
              status: 'completed',
            },
          }),
        }),
      ]),
    );
  }, 20_000);
});
