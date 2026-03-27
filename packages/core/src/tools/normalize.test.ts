import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { normalizeToMastraTool, normalizeToolsRecord } from './normalize';
import { Tool } from './tool';
import type { VercelTool } from './types';

describe('normalizeToMastraTool', () => {
  it('should return Mastra Tool instances as-is', () => {
    const mastraTool = new Tool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({ x: z.string() }),
      execute: async () => ({ success: true }),
    });

    const result = normalizeToMastraTool(mastraTool);
    expect(result).toBe(mastraTool);
  });

  it('should return ToolAction with inputSchema as-is', () => {
    const toolAction = {
      id: 'test-action',
      description: 'Test action',
      inputSchema: z.object({ x: z.string() }),
      execute: async () => ({ success: true }),
    };

    const result = normalizeToMastraTool(toolAction as any);
    expect(result).toBe(toolAction);
  });

  it('should convert Vercel tool with parameters to inputSchema', () => {
    const vercelTool: VercelTool = {
      description: 'Vercel tool',
      parameters: z.object({ location: z.string() }),
      execute: async (input: any) => ({ weather: `sunny in ${input.location}` }),
    };

    const result = normalizeToMastraTool(vercelTool);

    expect(result).toHaveProperty('inputSchema');
    expect(result).not.toHaveProperty('parameters');
    expect(result.description).toBe('Vercel tool');
    expect(result.execute).toBe(vercelTool.execute);
  });

  it('should preserve tool metadata during normalization', () => {
    const vercelTool = {
      description: 'Full featured tool',
      parameters: z.object({ x: z.number() }),
      execute: async () => ({ result: 42 }),
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral' } },
      },
      toModelOutput: (output: any) => output.result,
      inputExamples: [{ input: { x: 5 } }],
    };

    const result = normalizeToMastraTool(vercelTool as any) as any;

    expect(result).toHaveProperty('inputSchema');
    expect(result.providerOptions).toEqual({ anthropic: { cacheControl: { type: 'ephemeral' } } });
    expect(result.toModelOutput).toBe(vercelTool.toModelOutput);
    expect(result.inputExamples).toEqual([{ input: { x: 5 } }]);
  });

  it('should handle provider-defined tools by passing through', () => {
    const providerTool = {
      type: 'provider-defined' as const,
      id: 'openai.web_search' as const,
      description: 'Web search',
      args: {},
      execute: async () => ({}),
    };

    const result = normalizeToMastraTool(providerTool as any);

    // Provider tools should pass through unchanged
    expect(result).toBe(providerTool);
  });
});

describe('normalizeToolsRecord', () => {
  it('should normalize all tools in a record', () => {
    const vercelTool: VercelTool = {
      description: 'Vercel',
      parameters: z.object({ x: z.string() }),
      execute: async () => ({}),
    };

    const mastraTool = new Tool({
      id: 'mastra',
      description: 'Mastra',
      inputSchema: z.object({ y: z.number() }),
      execute: async () => ({}),
    });

    const tools = {
      vercel: vercelTool,
      mastra: mastraTool,
    };

    const result = normalizeToolsRecord(tools);

    expect(result.vercel).toHaveProperty('inputSchema');
    expect(result.vercel).not.toHaveProperty('parameters');
    expect(result.mastra).toBe(mastraTool);
  });

  it('should handle empty tool records', () => {
    const result = normalizeToolsRecord({});
    expect(result).toEqual({});
  });

  it('should handle mixed tool types', () => {
    const tools = {
      tool1: {
        description: 'Tool 1',
        parameters: z.object({ a: z.string() }),
        execute: async () => ({}),
      } as VercelTool,
      tool2: {
        id: 'tool2',
        description: 'Tool 2',
        inputSchema: z.object({ b: z.number() }),
        execute: async () => ({}),
      },
      tool3: {
        type: 'provider-defined' as const,
        id: 'openai.search' as const,
        description: 'Search',
        args: {},
        execute: async () => ({}),
      },
    };

    const result = normalizeToolsRecord(tools as any);

    expect(result.tool1).toHaveProperty('inputSchema');
    expect(result.tool2).toHaveProperty('inputSchema');
    expect((result.tool3 as any).type).toBe('provider-defined');
  });
});
