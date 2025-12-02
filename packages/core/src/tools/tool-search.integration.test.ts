import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';

import { Agent } from '../agent';

import { createTool } from './tool';
import { createToolSearch } from './tool-search';

/**
 * Integration tests for tool search with real LLM models.
 *
 * These tests verify that:
 * 1. The agent can discover tools via the search tool
 * 2. Found tools become available and can be called
 * 3. The full flow works end-to-end with real model inference
 *
 * Run with: OPENAI_API_KEY=... pnpm vitest run tool-search.integration.test.ts
 */

// Test tools
const weatherTool = createTool({
  id: 'weather.getCurrent',
  description: 'Get the current weather for a specific city or location',
  inputSchema: z.object({
    location: z.string().describe('The city name, e.g., "San Francisco" or "London"'),
  }),
  execute: async ({ location }) => ({
    location,
    temperature: 72,
    conditions: 'sunny',
    humidity: 45,
  }),
});

const createPRTool = createTool({
  id: 'github.createPullRequest',
  description: 'Create a new pull request on GitHub repository',
  inputSchema: z.object({
    title: z.string().describe('The title of the pull request'),
    body: z.string().optional().describe('The description of the pull request'),
  }),
  execute: async ({ title, body }) => ({
    success: true,
    prNumber: 42,
    prUrl: `https://github.com/example/repo/pull/42`,
    title,
    body,
  }),
});

const sendEmailTool = createTool({
  id: 'email.send',
  description: 'Send an email to a recipient',
  inputSchema: z.object({
    to: z.string().describe('Email recipient address'),
    subject: z.string().describe('Email subject line'),
    body: z.string().describe('Email body content'),
  }),
  execute: async ({ to, subject }) => ({
    success: true,
    messageId: 'msg-123',
    to,
    subject,
  }),
});

const calculatorTool = createTool({
  id: 'math.calculate',
  description: 'Perform mathematical calculations',
  inputSchema: z.object({
    expression: z.string().describe('Mathematical expression to evaluate, e.g., "2 + 2" or "sqrt(16)"'),
  }),
  execute: async ({ expression }) => {
    // Simple safe eval for basic math
    const result = Function(`"use strict"; return (${expression})`)();
    return { expression, result };
  },
});

const searchWebTool = createTool({
  id: 'web.search',
  description: 'Search the web for information on any topic',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query }) => ({
    query,
    results: [
      { title: `Result 1 for: ${query}`, url: 'https://example.com/1' },
      { title: `Result 2 for: ${query}`, url: 'https://example.com/2' },
    ],
  }),
});

const allTools = {
  'weather.getCurrent': weatherTool,
  'github.createPullRequest': createPRTool,
  'email.send': sendEmailTool,
  'math.calculate': calculatorTool,
  'web.search': searchWebTool,
};

// Provider configurations
const providers = [
  { provider: 'openai', model: 'gpt-4o-mini', envVar: 'OPENAI_API_KEY' },
  { provider: 'anthropic', model: 'claude-3-5-haiku-20241022', envVar: 'ANTHROPIC_API_KEY' },
];

describe('Tool Search Integration Tests', () => {
  let availableProviders: typeof providers = [];

  beforeAll(() => {
    availableProviders = providers.filter(({ envVar }) => process.env[envVar]);

    if (availableProviders.length === 0) {
      console.log('\n⚠️  No API keys configured for integration tests.');
      console.log('Set one or more of:');
      providers.forEach(({ envVar }) => console.log(`  - ${envVar}`));
      console.log('\nSkipping integration tests.\n');
    } else {
      console.log('\n✅ Running tool search integration tests with:', availableProviders.map(p => p.provider).join(', '));
    }
  });

  describe.each(providers)('$provider', ({ provider, model, envVar }) => {
    const modelId = `${provider}/${model}` as const;

    it('agent discovers and uses tool via search', { timeout: 60000 }, async () => {
      if (!process.env[envVar]) {
        console.log(`Skipping: ${envVar} not set`);
        return;
      }

      const toolSearch = await createToolSearch({
        tools: allTools,
        method: 'bm25',
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Tool Search Test Agent',
        instructions: `You are a helpful assistant. You have access to a tool_search tool that helps you find other tools.
When asked to do something, first search for relevant tools, then use them.
Always use the tools to complete tasks - don't just describe what you would do.`,
        model: modelId,
      });

      // First request: agent should search and find weather tool
      const response = await agent.generate("What's the weather in San Francisco?", {
        toolsets: { available: toolSearch() },
        maxSteps: 5,
      });

      // Check that tools were used
      const toolCalls = await response.toolCalls;
      expect(toolCalls.length).toBeGreaterThan(0);

      // Should have called tool_search
      const searchCall = toolCalls.find(tc => tc.payload.toolName === 'tool_search');
      expect(searchCall).toBeDefined();

      // Weather tool should now be loaded
      expect(toolSearch.loaded()).toContain('weather.getCurrent');

      // Response should contain weather information
      expect(response.text.toLowerCase()).toMatch(/san francisco|72|sunny|weather/i);

      // Reset for next test
      toolSearch.reset();
    });

    it('agent can chain multiple tool searches', { timeout: 60000 }, async () => {
      if (!process.env[envVar]) {
        console.log(`Skipping: ${envVar} not set`);
        return;
      }

      const toolSearch = await createToolSearch({ tools: allTools });

      const agent = new Agent({
        id: 'test-agent',
        name: 'Multi-Tool Agent',
        instructions: `You are a helpful assistant with access to tool_search.
Use tool_search to find tools, then use the found tools to complete tasks.
Complete all parts of multi-step requests.`,
        model: modelId,
      });

      const response = await agent.generate(
        'First check the weather in London, then calculate 15 * 7 for me.',
        {
          toolsets: { available: toolSearch() },
          maxSteps: 8,
        },
      );

      // Both tools should have been loaded
      const loaded = toolSearch.loaded();
      expect(loaded).toContain('weather.getCurrent');
      expect(loaded).toContain('math.calculate');

      // Response should contain both results
      const text = response.text.toLowerCase();
      expect(text).toMatch(/london|weather|105|15|7/i);

      toolSearch.reset();
    });

    it('search tool returns useful info when no match', { timeout: 30000 }, async () => {
      if (!process.env[envVar]) {
        console.log(`Skipping: ${envVar} not set`);
        return;
      }

      // Use high minScore to ensure no matches
      const toolSearch = await createToolSearch({
        tools: allTools,
        minScore: 0.99,
      });

      const agent = new Agent({
        id: 'test-agent',
        name: 'No Match Test Agent',
        instructions: 'You have access to tool_search. Search for tools as needed.',
        model: modelId,
      });

      const response = await agent.generate('Can you book a flight for me?', {
        toolsets: { available: toolSearch() },
        maxSteps: 3,
      });

      // Agent should indicate it can't help with flights
      expect(response.text.toLowerCase()).toMatch(/can't|cannot|don't have|not available|no.*tool/i);

      toolSearch.reset();
    });

    it('works with preloaded tools', { timeout: 30000 }, async () => {
      if (!process.env[envVar]) {
        console.log(`Skipping: ${envVar} not set`);
        return;
      }

      const toolSearch = await createToolSearch({ tools: allTools });

      // Preload a tool
      toolSearch.load('math.calculate');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Preload Test Agent',
        instructions: 'You are a math assistant. Use the math.calculate tool to solve problems.',
        model: modelId,
      });

      const response = await agent.generate('What is 25 * 4?', {
        toolsets: { available: toolSearch() },
        maxSteps: 3,
      });

      // Should have used the calculator
      const toolCalls = await response.toolCalls;
      const calcCall = toolCalls.find(tc => tc.payload.toolName === 'math.calculate');
      expect(calcCall).toBeDefined();

      // Response should contain the answer
      expect(response.text).toMatch(/100/);

      toolSearch.reset();
    });
  });

  describe('Search method comparison', () => {
    it('bm25 search finds relevant tools with natural language', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'bm25' });

      const results = await toolSearch.search('github pull request');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('github.createPullRequest');
    });

    it('regex search finds tools by exact substring', async () => {
      const toolSearch = await createToolSearch({ tools: allTools, method: 'regex' });

      // Regex looks for exact substrings
      const results = await toolSearch.search('GitHub');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('github.createPullRequest');
    });
  });
});
