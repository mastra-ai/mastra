import type { Message } from 'mem0ai';
import { describe, it, beforeAll, expect } from 'vitest';
import { Mem0Integration } from '.';

const API_KEY = process.env.MEM0_API_KEY;
if (!API_KEY) throw new Error(`MEM0_API_KEY env var is required for this test to run.`);

describe('mem0', () => {
  let integration: Mem0Integration;

  beforeAll(async () => {
    integration = new Mem0Integration({
      config: {
        apiKey: API_KEY,
        user_id: `mastra-test-${new Date().toISOString()}`,
      },
    });
  });

  describe('createMemory', () => {
    it('should create memory from string', async () => {
      const testString = 'This is a test memory';
      const result = await integration.createMemory(testString);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should create memory from messages array', async () => {
      const testMessages: Message[] = [
        {
          role: 'user',
          content: 'I love to eat pizza',
        },
        {
          role: 'user',
          content: 'I live in San Francisco',
        },
      ];
      const result = await integration.createMemory(testMessages);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('searchMemory', () => {
    it('should search memories with query', async () => {
      const query = 'What do I love to eat?';
      const result = await integration.searchMemory(query);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should search memories with options', async () => {
      const query = 'Where do I live?';
      const options = {
        user_id: 'alice',
      };
      const result = await integration.searchMemory(query, options);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});

