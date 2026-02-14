import { describe, it, expect, beforeAll, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';

export interface ToolTestConfig {
  testNameSuffix?: string;
}

export function createToolTests(config: ToolTestConfig = {}) {
  const { testNameSuffix } = config;
  const suiteName = testNameSuffix ? `Tool Client JS E2E Tests (${testNameSuffix})` : 'Tool Client JS E2E Tests';

  let client: MastraClient;

  describe(suiteName, () => {
    beforeAll(async () => {
      const baseUrl = inject('baseUrl');
      client = new MastraClient({ baseUrl, retries: 0 });
    });

    describe('listTools', () => {
      it('should return a record of tools', async () => {
        const tools = await client.listTools();
        expect(tools).toBeDefined();
        expect(typeof tools).toBe('object');
        expect(tools['calculator']).toBeDefined();
        expect(tools['greeter']).toBeDefined();
      });
    });

    describe('getTool', () => {
      it('should return calculator tool details', async () => {
        const tool = client.getTool('calculator');
        const details = await tool.details();
        expect(details).toBeDefined();
        expect(details.id).toBe('calculator');
        expect(details.description).toBe('Adds two numbers together');
      });

      it('should return greeter tool details', async () => {
        const tool = client.getTool('greeter');
        const details = await tool.details();
        expect(details).toBeDefined();
        expect(details.id).toBe('greeter');
        expect(details.description).toBe('Greets a person by name');
      });

      it('should throw for non-existent tool', async () => {
        const tool = client.getTool('nonexistent-tool');
        await expect(tool.details()).rejects.toThrow();
      });
    });

    describe('execute tool', () => {
      it('should execute calculator tool and return correct result', async () => {
        const tool = client.getTool('calculator');
        const result = await tool.execute({ data: { a: 5, b: 3 } });
        expect(result).toBeDefined();
        expect(result.result).toBe(8);
      });

      it('should execute calculator with negative numbers', async () => {
        const tool = client.getTool('calculator');
        const result = await tool.execute({ data: { a: -10, b: 3 } });
        expect(result).toBeDefined();
        expect(result.result).toBe(-7);
      });

      it('should execute greeter tool and return greeting', async () => {
        const tool = client.getTool('greeter');
        const result = await tool.execute({ data: { name: 'World' } });
        expect(result).toBeDefined();
        expect(result.greeting).toBe('Hello, World!');
      });

      it('should return validation error for invalid data', async () => {
        const tool = client.getTool('calculator');
        const result: any = await tool.execute({ data: { a: 'not-a-number', b: 3 } });
        // Tool returns a validation error object instead of throwing
        expect(result).toBeDefined();
        expect(result.error).toBeDefined();
      });
    });
  });
}
