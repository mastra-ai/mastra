import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent/index.js';

// Test configuration for different providers
const testConfigs = [
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    envVar: 'OPENAI_API_KEY',
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    envVar: 'ANTHROPIC_API_KEY',
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  {
    provider: 'openrouter',
    model: 'openai/gpt-4o-mini',
    envVar: 'OPENROUTER_API_KEY',
  },
  // Note: Azure OpenAI is tested separately in azure.integration.test.ts
  // It requires an AzureOpenAIGateway instance and can't use ModelsDevGateway
];

// Simple tool for testing tool calling
const weatherTool = {
  description: 'Get the weather for a location',
  parameters: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  }),
  execute: async ({ location }: { location: string }) => {
    return {
      location,
      temperature: 72,
      conditions: 'sunny',
    };
  },
};

describe('ModelRouter Integration Tests', () => {
  let availableProviders: string[] = [];

  beforeAll(() => {
    // Check which providers have API keys configured
    availableProviders = testConfigs.filter(({ envVar }) => process.env[envVar]).map(({ provider }) => provider);

    if (availableProviders.length === 0) {
      console.log('\n⚠️  No API keys configured. Set one or more of:');
      testConfigs.forEach(({ envVar }) => {
        console.log(`   - ${envVar}`);
      });
      console.log('\nSkipping all integration tests.\n');
    } else {
      console.log('\n✅ Testing with providers:', availableProviders.join(', '));
    }
  });

  describe('Custom OpenAI-Compatible Config', () => {
    it('should work with custom URL config for Anthropic', async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for this test');
      }

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'custom-anthropic/claude-haiku-4-5',
          url: 'https://api.anthropic.com/v1',
          apiKey: process.env.ANTHROPIC_API_KEY,
          headers: {
            'anthropic-version': '2023-06-01',
          },
        },
        tools: { get_weather: weatherTool },
      });

      const response = await agent.generate('What is 2+2?');
      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
      expect(response.text.length).toBeGreaterThan(0);
    });

    it('should work with custom URL config for OpenAI', async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is required for this test');
      }

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: {
          id: 'custom-openai/gpt-4o-mini',
          url: 'https://api.openai.com/v1',
          apiKey: process.env.OPENAI_API_KEY,
        },
        tools: { get_weather: weatherTool },
      });

      const response = await agent.generate('What is the capital of France?');
      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
      expect(response.text.toLowerCase()).toContain('paris');
    });
  });

  describe.each(testConfigs)('$provider/$model', ({ provider, model, envVar }) => {
    const modelId = `${provider}/${model}` as const;
    const isGemini = modelId.includes('gemini-2.0-flash');
    const skipInCI = process.env.CI === 'true' && isGemini;

    it.skipIf(skipInCI)('should generate text response', async () => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not set - required for ${provider} integration tests`);
      }

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: modelId,
      });

      const response = await agent.generate('Say "Hello from Mastra!" and nothing else.');

      expect(response).toBeDefined();
      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
      expect(response.text.toLowerCase()).toContain('hello');
    });

    it.skipIf(skipInCI)('should handle tool calling', async () => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not set - required for ${provider} integration tests`);
      }

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: modelId,
        tools: {
          get_weather: weatherTool,
        },
      });

      const response = await agent.generate('What is the weather in San Francisco?', {
        toolChoice: 'required',
        maxSteps: 1,
      });

      const toolCalls = await response.toolCalls;
      expect(toolCalls).toBeDefined();
      expect(toolCalls.length).toBeGreaterThan(0);
      expect(toolCalls[0].payload.toolName).toBe('get_weather');
      expect(toolCalls[0].payload.args).toHaveProperty('location');
    });

    it.skipIf(skipInCI)('should support system messages via instructions', async () => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not set - required for ${provider} integration tests`);
      }

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a pirate. Always respond like a pirate.',
        model: modelId,
      });

      const response = await agent.generate('Say hello');

      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
      // Pirate-like responses often contain these words
      const pirateWords = ['ahoy', 'matey', 'arr', 'ye', 'aye'];
      const hasPirateWord = pirateWords.some(word => response.text.toLowerCase().includes(word));
      expect(hasPirateWord).toBe(true);
    });

    it.skipIf(skipInCI)('should support streaming', { timeout: 30000 }, async () => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not set - required for ${provider} integration tests`);
      }

      const agent = new Agent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'You are a helpful assistant.',
        model: modelId,
      });

      const { textStream } = await agent.stream('Count from 1 to 3');

      const chunks: string[] = [];
      for await (const chunk of textStream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      const fullText = chunks.join('');
      expect(fullText).toBeDefined();
      expect(typeof fullText).toBe('string');
    });
  });

  describe('Model ID Validation', () => {
    it('should accept valid model IDs at construction time', () => {
      const validIds = ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet-20241022', 'google/gemini-2.0-flash'] as const;

      validIds.forEach(id => {
        expect(
          () =>
            new Agent({
              id: 'test-agent',
              name: 'test-agent',
              instructions: 'test',
              model: id,
            }),
        ).not.toThrow();
      });
    });
  });
});
