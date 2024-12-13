import { describe, it, expect } from '@jest/globals';
import dotenv from 'dotenv';
import { z } from 'zod';

import { Logger, createLogger } from '../logger';
import { Mastra } from '../mastra';
import { createTool } from '../tools';

import { EmbeddingModelConfig } from './embeddings';

// Load environment variables
dotenv.config();

const calculatorTool = createTool({
  id: 'Calculator',
  description: 'A simple calculator tool',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ context }) => {
    return { result: context.a + context.b };
  },
});

const mastra = new Mastra({
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});

describe('LLM Class Integration Tests', () => {
  let logger: Logger;

  beforeAll(() => {
    // Setup real logger
    logger = {
      debug: (msg: any) => console.debug(msg),
      info: (msg: any) => console.info(msg),
      warn: (msg: any) => console.warn(msg),
      error: (msg: any) => console.error(msg),
    };
  });

  const llm = mastra.LLM({
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  });

  describe('OpenAI Integration', () => {
    it('should generate text completion', async () => {
      const response = await llm.generate('What is 2+2?');
      expect(response.text).toBeDefined();
      expect(typeof response.text).toBe('string');
    }, 30000);

    it('should generate structured output', async () => {
      const schema = z.object({
        answer: z.number(),
        explanation: z.string(),
      });

      const response = await llm.generate('What is 2+2?', { schema });
      expect(response.object).toBeDefined();
      expect(response.object.answer).toBe(4);
      expect(typeof response.object.explanation).toBe('string');
    }, 30000);

    it('should stream text completion', async () => {
      const chunks: string[] = [];
      const response = await llm.generate('Count from 1 to 5.', {
        stream: true,
        onFinish: text => {
          chunks.push(text);
          return;
        },
      });

      for await (const chunk of response.textStream) {
        // Write each chunk without a newline to create a continuous stream
        expect(chunk).toBeDefined();
      }

      expect(chunks.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Tool Integration', () => {
    const llm = mastra.LLM({
      provider: 'OPEN_AI',
      name: 'gpt-4',
    });

    it('should use tools in generation', async () => {
      const response = await llm.generate('What is 123 + 456? Use the calculator tool to find out.', {
        tools: {
          calculatorTool,
        },
      });

      expect(response.text).toBeDefined();
      expect(response.text).toContain('579');
    }, 30000);
  });

  describe('createEmbedding', () => {
    const llm = mastra.LLM({
      provider: 'OPEN_AI',
      name: 'gpt-3.5-turbo',
    });

    it('should create an embedding for a single string value using OpenAI provider', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'OPEN_AI',
        name: 'text-embedding-3-small',
      };
      const value = 'This is a test string';
      const maxRetries = 3;

      const embedding = await llm.createEmbedding({
        model,
        value,
        maxRetries,
      });
      console.log(embedding);

      expect(embedding).toBeDefined();
    });

    it.skip('should create an embedding for a single string value using Cohere provider', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'COHERE',
        name: 'embed-english-v3.0',
      };
      const value = 'This is a test string';
      const maxRetries = 3;

      const embedding = await llm.createEmbedding({
        model,
        value,
        maxRetries,
      });
      console.log(embedding);

      expect(embedding).toBeDefined();
    });

    it('should create embeddings for an array of string values', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'OPEN_AI',
        name: 'text-embedding-3-small',
      };
      const value = ['String 1', 'String 2', 'String 3'];
      const maxRetries = 3;

      const embeddings = await llm.createEmbedding({
        model,
        value,
        maxRetries,
      });
      console.log(embeddings);

      expect(embeddings).toBeDefined();
    });

    it('should throw an error for an invalid embedding model provider', async () => {
      const model: EmbeddingModelConfig = {
        provider: 'INVALID_PROVIDER' as any,
        name: 'text-embedding-ada-002',
      };
      const value = 'This is a test string';
      const maxRetries = 3;

      await expect(llm.createEmbedding({ model, value, maxRetries })).rejects.toThrow('Invalid embedding model');
    });
  });

  describe('Error Handling', () => {
    const llm = mastra.LLM({
      provider: 'INVALID_PROVIDER' as any,
      name: 'invalid-model',
    });

    it('should handle invalid model configurations', async () => {
      await expect(llm.generate('test')).rejects.toThrow();
    });

    it('should handle missing API keys', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      await expect(llm.generate('test')).rejects.toThrow();

      process.env.OPENAI_API_KEY = originalKey;
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limits gracefully', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() => llm.generate('What is 2+2?'));

      const results = await Promise.allSettled(promises);
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);
    }, 60000);
  });
});
