import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { processClientTools } from './process-client-tools';

// Helper to create base Vercel tool shape
const makeVercelTool = (params?: z.ZodTypeAny) => ({
  api: 'https://api.vercel.com/v1',
  auth: 'token',
  ...(params ? { parameters: params } : {}),
});

// Helper to process a single tool
const processSingleTool = (tool: any) => {
  const result = processClientTools({ testTool: tool });
  return result?.testTool;
};

// Helper to verify core properties are preserved
const expectCorePropsPreserved = (original: any, processed: any) => {
  expect(processed).toBeDefined();
  expect(processed.api).toBe(original.api);
  expect(processed.auth).toBe(original.auth);
};

describe('processClientTools', () => {
  it('should correctly transform the parameters field using zodToJsonSchema when processing a Vercel tool that has parameters defined', () => {
    // Arrange: Create a Vercel tool with parameters
    const vercelTool = makeVercelTool(
      z.object({
        key: z.string(),
      }),
    );

    // Act: Process the single tool
    const result = processSingleTool(vercelTool);

    // Assert: Verify the parameters transformation (allowing additional fields like $schema, additionalProperties)
    expect(result.parameters).toMatchObject({
      type: 'object',
      properties: {
        key: { type: 'string' },
      },
    });
    expect(result.parameters.required).toContain('key');

    // Verify core properties are preserved
    expectCorePropsPreserved(vercelTool, result);
  });

  it('should set parameters to undefined when processing a Vercel tool that has no parameters field', () => {
    // Arrange: Create a Vercel tool without parameters
    const vercelTool = makeVercelTool();

    // Act: Process the single tool
    const result = processSingleTool(vercelTool);

    // Assert: Verify parameters is undefined
    expect(result.parameters).toBeUndefined();

    // Verify core properties are preserved
    expectCorePropsPreserved(vercelTool, result);
  });
});
