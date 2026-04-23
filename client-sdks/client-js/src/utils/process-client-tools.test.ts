import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { processClientTools } from './process-client-tools';

describe('processClientTools', () => {
  it('should convert Zod inputSchema for ClientTool without execute', () => {
    const clientTools = {
      myTool: {
        id: 'my-tool',
        description: 'A test tool',
        inputSchema: z.object({ location: z.string() }),
      },
    };

    const result = processClientTools(clientTools as any);
    const tool = result!['myTool'] as any;

    // inputSchema should be converted to JSON Schema (not a Zod instance)
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties?.location).toBeDefined();
    expect(tool.inputSchema.properties?.location?.type).toBe('string');
  });

  it('should convert Zod inputSchema for ClientTool WITH execute (regression test for issue #11668)', () => {
    const clientTools = {
      weatherTool: {
        id: 'weather-tool',
        description: 'Get weather for a location',
        inputSchema: z.object({ location: z.string().describe('City name') }),
        execute: async (_ctx: any) => ({ temperature: 72 }),
      },
    };

    const result = processClientTools(clientTools as any);
    const tool = result!['weatherTool'] as any;

    // inputSchema should be converted to JSON Schema (not a Zod instance)
    // Before the fix, this would leave inputSchema as an unconverted Zod schema
    // because isVercelTool returned true for tools with execute + inputSchema
    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.properties?.location).toBeDefined();
    expect(tool.inputSchema.properties?.location?.type).toBe('string');
  });

  it('should convert Zod parameters for Vercel v4 tool format', () => {
    const clientTools = {
      myVercelTool: {
        description: 'A vercel tool',
        parameters: z.object({ query: z.string() }),
        execute: async (_args: any) => ({ result: 'ok' }),
      },
    };

    const result = processClientTools(clientTools as any);
    const tool = result!['myVercelTool'] as any;

    expect(tool.parameters).toBeDefined();
    expect(tool.parameters.type).toBe('object');
    expect(tool.parameters.properties?.query).toBeDefined();
  });

  it('should return undefined for undefined input', () => {
    expect(processClientTools(undefined)).toBeUndefined();
  });

  it('should convert outputSchema when present', () => {
    const clientTools = {
      myTool: {
        id: 'my-tool',
        description: 'A test tool',
        inputSchema: z.object({ location: z.string() }),
        outputSchema: z.object({ temperature: z.number() }),
        execute: async (_ctx: any) => ({ temperature: 72 }),
      },
    };

    const result = processClientTools(clientTools as any);
    const tool = result!['myTool'] as any;

    expect(tool.inputSchema).toBeDefined();
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.outputSchema).toBeDefined();
    expect(tool.outputSchema.type).toBe('object');
    expect(tool.outputSchema.properties?.temperature).toBeDefined();
  });
});
