import { anthropic } from '@ai-sdk/anthropic-v5';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v5';
import { google } from '@ai-sdk/google-v5';
import { openai } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

describe('provider-defined tools', () => {
  it('should handle Google search tool', { timeout: 120000 }, async () => {
    const search = google.tools.googleSearch({});

    const agent = new Agent({
      id: 'minimal-agent',
      name: 'minimal-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: 'google/gemini-2.5-flash',
      tools: { search },
    });

    // Test actual execution with agent
    const result = await agent.generate(
      'Search for information about TypeScript programming language using the search tool',
      {
        toolChoice: 'search',
      },
    );

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.text).toContain('TypeScript');

    // These are the web search sources that were used to generate the response
    expect(result.sources.length).toBeGreaterThan(0);
    // These are the web search queries that were used to generate the response
    expect((result.providerMetadata?.google?.groundingMetadata as any)?.webSearchQueries?.length).toBeGreaterThan(0);
  });

  it('should handle Google URL context tool', async () => {
    const agent = new Agent({
      id: 'test-google-url-agent',
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

  it('should handle Google code execution tool', async () => {
    const agent = new Agent({
      id: 'test-google-code-agent',
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

  it('should handle openai web search tool', { timeout: 30000 }, async () => {
    const tool = openai.tools.webSearch({});

    const agent = new Agent({
      id: 'test-openai-web-search-agent',
      name: 'test-openai-web-search-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: 'openai/gpt-4o-mini',
      tools: { search: tool },
    });

    const result = await agent.generate(
      'Search for information about TypeScript programming language using the search tool',
      {},
    );

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();
    expect(result.text).toContain('TypeScript');

    // These are the web search sources that were used to generate the response
    expect(result.sources.length).toBeGreaterThan(0);

    // Openai web search acts as a reguar tool call/result
    const webSearchToolCall = result.toolCalls.find(tc => tc.payload.toolName === 'web_search');
    expect(webSearchToolCall).toBeDefined();
    expect(webSearchToolCall?.payload.providerExecuted).toBe(true);

    const webSearchToolResult = result.toolResults.find(tr => tr.payload.toolName === 'web_search');
    expect(webSearchToolResult).toBeDefined();
    expect(webSearchToolResult?.payload.providerExecuted).toBe(true);
  });

  it('should handle anthropic web search tool', { timeout: 30000 }, async () => {
    const tool = anthropic.tools.webSearch_20250305({});

    const agent = new Agent({
      id: 'minimal-agent',
      name: 'minimal-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      tools: { search: tool },
    });

    const result = await agent.generate(
      'Search for information about TypeScript programming language using the search tool',
    );

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();

    // These are the web search sources that were used to generate the response
    expect(result.sources.length).toBeGreaterThan(0);

    // Anthropic web search acts as a reguar tool call/result
    const webSearchToolCall = result.toolCalls.find(tc => tc.payload.toolName === 'web_search');
    expect(webSearchToolCall).toBeDefined();
    expect(webSearchToolCall?.payload.providerExecuted).toBe(true);

    const webSearchToolResult = result.toolResults.find(tr => tr.payload.toolName === 'web_search');
    expect(webSearchToolResult).toBeDefined();
    expect(webSearchToolResult?.payload.providerExecuted).toBe(true);
  });

  it('should handle anthropic skills', { timeout: 30000 }, async () => {
    const tool = anthropic.tools.codeExecution_20250522({});

    const agent = new Agent({
      id: 'test-anthropic-skills-agent',
      name: 'minimal-agent',
      instructions: 'You are a search assistant.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      tools: { codeExecution: tool },
    });

    const result = await agent.generate('Create a short document about the benefits of using Typescript in 100 words', {
      providerOptions: {
        container: {
          skills: [
            {
              type: 'anthropic',
              skillId: 'docx',
            },
          ],
        },
      } satisfies AnthropicProviderOptions,
    });

    expect(result).toBeDefined();
    expect(result.text).toBeDefined();

    const toolCall = result.toolCalls.find(tc => tc.payload.toolName === 'code_execution');
    expect(toolCall).toBeDefined();
    expect(toolCall?.payload.providerExecuted).toBe(true);

    const toolResult = result.toolResults.find(tr => tr.payload.toolName === 'code_execution');
    expect(toolResult).toBeDefined();
    expect(toolResult?.payload.providerExecuted).toBe(true);
    expect((toolResult?.payload.result as any).type).toBe('code_execution_result');
  });
});
