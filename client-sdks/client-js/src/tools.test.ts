import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from './tools';

describe('createTool', () => {
  it('should create a tool with basic properties', () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'A test tool',
    });

    expect(tool.id).toBe('test-tool');
    expect(tool.description).toBe('A test tool');
  });

  it('should create a tool with input schema & output schema', () => {
    const inputSchema = z.object({
      message: z.string(),
    });
    const outputSchema = z.object({
      message: z.string(),
    });

    const tool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema,
      outputSchema: outputSchema,
    });

    expect(tool.inputSchema).toBe(inputSchema);
    expect(tool.outputSchema).toBe(outputSchema);
  });

  it('should create a tool with execute function', async () => {
    const tool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({
        color: z.string(),
      }),
      execute: async input => {
        return { success: true, color: input.color };
      },
    });

    const result = await tool.execute?.(
      { color: 'blue' },
      { observe: { span: async (_name, fn) => fn(), log: () => {} } },
    );
    expect(result).toEqual({ success: true, color: 'blue' });
  });

  it('should pass a tool execution context to execute', async () => {
    const observe = {
      span: async <T>(_name: string, fn: () => T | Promise<T>) => fn(),
      log: () => {},
    };
    const tool = createTool({
      id: 'test-tool',
      description: 'A test tool',
      inputSchema: z.object({
        color: z.string(),
      }),
      execute: async (input, context) => {
        const result = await context.observe.span('read color', () => input.color);
        return { result };
      },
    });

    const result = await tool.execute?.({ color: 'blue' }, { observe });
    expect(result).toEqual({ result: 'blue' });
  });
});
