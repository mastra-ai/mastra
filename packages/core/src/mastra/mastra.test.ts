import { describe, it, expect } from '@jest/globals';
import { Mastra } from './index';
import { z } from 'zod';

describe('Mastra', () => {
  it('should initialize with tools and execute them', async () => {
    const testTool = {
      name: 'testTool',
      description: 'A test tool',
      schema: z.object({
        input: z.string(),
      }),
      executor: ({ data }: { data: { input: string } }) => {
        return `Executed with ${data.input}`;
      },
    };

    const mastra = new Mastra({
      tools: {
        testTool,
      },
    });

    const tool = mastra.getTool('testTool');
    const result = await tool.execute({ input: 'test' });

    expect(result).toBe('Executed with test');
  });

  it('should throw when accessing non-existent tool', () => {
    const mastra = new Mastra({});

    expect(() => {
      mastra.getTool('nonExistentTool');
    }).toThrow('Tool with name nonExistentTool not found');
  });
});
