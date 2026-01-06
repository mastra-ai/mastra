import { anthropic } from '@ai-sdk/anthropic-v5';
import type { AnthropicProviderOptions } from '@ai-sdk/anthropic-v5';
import { google } from '@ai-sdk/google-v5';
import { openai } from '@ai-sdk/openai-v5';
import { openai as openaiV6 } from '@ai-sdk/openai-v6';
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

  it('stream - should handle openai web search tool', { timeout: 30000 }, async () => {
    const tool = openai.tools.webSearch({});

    const agent = new Agent({
      id: 'test-openai-web-search-agent',
      name: 'test-openai-web-search-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: 'openai/gpt-4o-mini',
      tools: { search: tool },
    });

    const result = await agent.stream(
      'Search for information about TypeScript programming language using the search tool',
      {},
    );

    await result.consumeStream();

    expect(result).toBeDefined();

    const text = await result.text;

    expect(text).toBeDefined();
    expect(text).toContain('TypeScript');

    const sources = await result.sources;

    // These are the web search sources that were used to generate the response
    expect(sources.length).toBeGreaterThan(0);

    const toolCalls = await result.toolCalls;

    // Openai web search acts as a reguar tool call/result
    const webSearchToolCall = toolCalls.find(tc => tc.payload.toolName === 'web_search');
    expect(webSearchToolCall).toBeDefined();
    expect(webSearchToolCall?.payload.providerExecuted).toBe(true);

    const toolResults = await result.toolResults;

    const webSearchToolResult = toolResults.find(tr => tr.payload.toolName === 'web_search');
    expect(webSearchToolResult).toBeDefined();
    expect(webSearchToolResult?.payload.providerExecuted).toBe(true);
  });

  it('generate - should handle openai web search tool', { timeout: 30000 }, async () => {
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

  it('stream - should handle anthropic web search tool', { timeout: 30000 }, async () => {
    const tool = anthropic.tools.webSearch_20250305({});

    const agent = new Agent({
      id: 'test-anthropic-web-search-agent',
      name: 'test-anthropic-web-search-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      tools: { search: tool },
    });

    const result = await agent.stream(
      'Search for information about TypeScript programming language using the search tool',
      {},
    );

    await result.consumeStream();

    expect(result).toBeDefined();

    const text = await result.text;

    expect(text).toBeDefined();

    const sources = await result.sources;

    // These are the web search sources that were used to generate the response
    expect(sources.length).toBeGreaterThan(0);

    const toolCalls = await result.toolCalls;

    // Anthropic web search acts as a reguar tool call/result
    const webSearchToolCall = toolCalls.find(tc => tc.payload.toolName === 'web_search');
    expect(webSearchToolCall).toBeDefined();
    expect(webSearchToolCall?.payload.providerExecuted).toBe(true);

    const toolResults = await result.toolResults;

    const webSearchToolResult = toolResults.find(tr => tr.payload.toolName === 'web_search');
    expect(webSearchToolResult).toBeDefined();
    expect(webSearchToolResult?.payload.providerExecuted).toBe(true);
  });

  it('generate - should handle anthropic web search tool', { timeout: 30000 }, async () => {
    const tool = anthropic.tools.webSearch_20250305({});

    const agent = new Agent({
      id: 'test-anthropic-web-search-agent',
      name: 'test-anthropic-web-search-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      tools: { search: tool },
    });

    const result = await agent.generate(
      'Search for information about TypeScript programming language using the search tool',
      {},
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

  it('stream - should handle anthropic skills', { timeout: 30000 }, async () => {
    const tool = anthropic.tools.codeExecution_20250522({});

    const agent = new Agent({
      id: 'test-anthropic-skills-agent',
      name: 'test-anthropic-skills-agent',
      instructions: 'You are an assistant that can execute code.',
      model: 'anthropic/claude-haiku-4-5-20251001',
      tools: { codeExecution: tool },
    });

    const result = await agent.stream('Create a short document about the benefits of using Typescript in 100 words', {
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

    await result.consumeStream();

    expect(result).toBeDefined();

    const text = await result.text;
    expect(text).toBeDefined();

    const toolCalls = await result.toolCalls;

    const toolCall = toolCalls.find(tc => tc.payload.toolName === 'code_execution');
    expect(toolCall).toBeDefined();
    expect(toolCall?.payload.providerExecuted).toBe(true);

    const toolResults = await result.toolResults;

    const toolResult = toolResults.find(tr => tr.payload.toolName === 'code_execution');
    expect(toolResult).toBeDefined();
    expect(toolResult?.payload.providerExecuted).toBe(true);
    expect((toolResult?.payload.result as any).type).toBe('code_execution_result');
  });

  it('generate - should handle anthropic skills', { timeout: 30000 }, async () => {
    const tool = anthropic.tools.codeExecution_20250522({});

    const agent = new Agent({
      id: 'test-anthropic-skills-agent',
      name: 'test-anthropic-skills-agent',
      instructions: 'You are an assistant that can execute code.',
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

// NOTE: AI SDK v6 (@ai-sdk/openai@3) webSearch tests were previously skipped because of
// what was thought to be an upstream bug. The issue was actually that Mastra's tool preparation
// was using V2 tool types ('provider-defined') when V3 models expect ('provider').
// This has been fixed in prepare-tools.ts by using the correct tool type based on model version.
describe('provider-defined tools with AI SDK v6 (@ai-sdk/openai@3)', () => {
  it('stream - should handle openai web search tool with v6 provider', { timeout: 60000 }, async () => {
    const tool = openaiV6.tools.webSearch({});

    const agent = new Agent({
      id: 'test-openai-v6-web-search-agent',
      name: 'test-openai-v6-web-search-agent',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: openaiV6('gpt-4o-mini'),
      tools: { search: tool },
    });

    const result = await agent.stream('What is the capital of France? Use the search tool to find the answer.', {});

    await result.consumeStream();

    expect(result).toBeDefined();

    const text = await result.text;
    const finishReason = await result.finishReason;
    const toolCalls = await result.toolCalls;
    const toolResults = await result.toolResults;

    // Verify web search tool was called
    const webSearchToolCall = toolCalls.find(tc => tc.payload.toolName === 'web_search');
    expect(webSearchToolCall).toBeDefined();
    expect(webSearchToolCall?.payload.providerExecuted).toBe(true);

    // Verify web search tool result was processed
    const webSearchToolResult = toolResults.find(tr => tr.payload.toolName === 'web_search');
    expect(webSearchToolResult).toBeDefined();
    // Note: providerExecuted flag on tool results is optional - the key check is that the result exists

    // The agent should generate a text response after processing the web search results
    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
    // The response should mention Paris (the capital of France)
    expect(text.toLowerCase()).toContain('paris');

    // Verify finish reason is 'stop' (not 'tool-calls')
    expect(finishReason).toBe('stop');
  });

  it('generate - should handle openai web search tool with v6 provider', { timeout: 60000 }, async () => {
    const tool = openaiV6.tools.webSearch({});

    const agent = new Agent({
      id: 'test-openai-v6-web-search-agent-generate',
      name: 'test-openai-v6-web-search-agent-generate',
      instructions: 'You are a search assistant. When asked to search for something, always use the search tool.',
      model: openaiV6('gpt-4o-mini'),
      tools: { search: tool },
    });

    const result = await agent.generate('What is the capital of France? Use the search tool to find the answer.', {});

    expect(result).toBeDefined();

    // The agent should generate a text response after processing the web search results
    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text.toLowerCase()).toContain('paris');

    // Verify web search tool was called
    const webSearchToolCall = result.toolCalls.find(tc => tc.payload.toolName === 'web_search');
    expect(webSearchToolCall).toBeDefined();
    expect(webSearchToolCall?.payload.providerExecuted).toBe(true);

    // Verify web search tool result was processed
    const webSearchToolResult = result.toolResults.find(tr => tr.payload.toolName === 'web_search');
    expect(webSearchToolResult).toBeDefined();
    // Note: For provider-executed tools, the result may not have providerExecuted flag
    // since it's implied by the presence of the tool result from a provider tool

    // Verify finish reason is 'stop' (not 'tool-calls')
    expect(result.finishReason).toBe('stop');
  });
});
