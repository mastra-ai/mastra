import { openai } from '@ai-sdk/openai-v5';
import { google } from '@ai-sdk/google-v5';
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

  it('should handle Google search tool without type errors', async () => {
    // This test reproduces the issue from #8455
    // The goal is to verify that google.tools.googleSearch() can be assigned to Agent tools without type errors
    const agent = new Agent({
      name: 'test-google-agent',
      instructions: 'You are a helpful AI assistant with access to Google search capabilities.',
      model: google('gemini-2.0-flash-exp'),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
    });

    // Type assertion test - if this compiles without error, the type issue is fixed
    expect(agent).toBeDefined();
    expect(agent.name).toBe('test-google-agent');
  });

  it('should handle Google URL context tool without type errors', async () => {
    const agent = new Agent({
      name: 'test-google-url-agent',
      instructions: 'You are a helpful AI assistant.',
      model: google('gemini-2.0-flash-exp'),
      tools: {
        url_context: google.tools.urlContext({}),
      },
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe('test-google-url-agent');
  });

  it('should handle Google code execution tool without type errors', async () => {
    const agent = new Agent({
      name: 'test-google-code-agent',
      instructions: 'You are a helpful AI assistant.',
      model: google('gemini-2.0-flash-exp'),
      tools: {
        code_execution: google.tools.codeExecution({}),
      },
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe('test-google-code-agent');
  });
});
