import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { processClientTools } from './process-client-tools';

describe('processClientTools', () => {
  // Helper functions
  const expectToolFieldsPreserved = (
    processedTool: { name: string; description?: string },
    inputTool: { name: string; description?: string },
  ) => {
    expect(processedTool.name).toBe(inputTool.name);
    expect(processedTool.description).toBe(inputTool.description);
  };

  const expectResultKeysMatchInput = (result: object, input: object) => {
    expect(Object.keys(result)).toEqual(Object.keys(input));
  };

  it('should return undefined when clientTools input is undefined', () => {
    const result = processClientTools(undefined);
    expect(result).toBeUndefined();
  });

  it('should correctly transform the parameters field using zodToJsonSchema when processing a Vercel tool that has parameters defined', () => {
    // Arrange: Create ToolsInput with Vercel tool containing parameters
    const parameterSchema = z.object({
      key: z.string(),
    });

    const input = {
      testTool: {
        name: 'Test Tool',
        description: 'A test tool',
        parameters: parameterSchema,
      },
    };

    // Act: Process the tools input
    const result = processClientTools(input);

    // Assert: Validate schema transformation and field preservation
    expect(result).toBeDefined();
    const processedTool: any = (result as any)!.testTool;

    // Validate structural shape of the generated JSON Schema
    expect(processedTool.parameters).toBeDefined();
    expect(typeof processedTool.parameters).toBe('object');

    const schema: any = processedTool.parameters;
    expect(schema).toBeDefined();
    expect(schema.properties).toBeDefined();
    expect(schema.properties.key).toBeDefined();
    expect(schema.properties.key.type).toBe('string');

    // Assert required is present and contains 'key'
    expect(schema.required).toBeDefined();
    expect(Array.isArray(schema.required)).toBe(true);
    expect(schema.required).toContain('key');

    // Check field preservation and structure
    expectToolFieldsPreserved(processedTool, input.testTool);
    expectResultKeysMatchInput(result as any, input as any);
  });

  it('should set parameters to undefined when processing a Vercel tool that has no parameters field', () => {
    // Arrange: Create ToolsInput with Vercel tool without parameters
    const input = {
      testTool: {
        name: 'Test Tool',
        description: 'A test tool',
      },
    };

    // Act: Process the tools input
    const result = processClientTools(input);

    // Assert: Validate undefined parameters and field preservation
    expect(result).toBeDefined();
    const processedTool: any = (result as any)!.testTool;

    expect(processedTool.parameters).toBeUndefined();

    // Check field preservation and structure
    expectToolFieldsPreserved(processedTool, input.testTool);
    expectResultKeysMatchInput(result as any, input as any);
  });

  it('should correctly process multiple Vercel tools while preserving all properties', () => {
    // Arrange: Create input with multiple Vercel tools
    const firstParameterSchema = z.object({
      message: z.string(),
      count: z.number(),
    });

    const secondParameterSchema = z.object({
      query: z.string(),
      filters: z.array(z.string()),
    });

    const input = {
      toolOne: {
        name: 'First Tool',
        description: 'A test tool with string and number parameters',
        parameters: firstParameterSchema,
      },
      toolTwo: {
        name: 'Second Tool',
        description: 'A test tool with string and array parameters',
        parameters: secondParameterSchema,
      },
    };

    // Act: Process the tools input
    const result = processClientTools(input);

    // Assert: Validate schema transformation and field preservation for both tools
    expect(result).toBeDefined();
    const processedToolOne = (result as any)!.toolOne;
    const processedToolTwo = (result as any)!.toolTwo;

    // Verify first tool
    expectToolFieldsPreserved(processedToolOne, input.toolOne);
    expect(processedToolOne.parameters).toBeDefined();
    expect(processedToolOne.parameters.properties).toBeDefined();
    expect(processedToolOne.parameters.properties.message.type).toBe('string');
    expect(processedToolOne.parameters.properties.count.type).toBe('number');
    expect(processedToolOne.parameters.required).toContain('message');
    expect(processedToolOne.parameters.required).toContain('count');

    // Verify second tool
    expectToolFieldsPreserved(processedToolTwo, input.toolTwo);
    expect(processedToolTwo.parameters).toBeDefined();
    expect(processedToolTwo.parameters.properties).toBeDefined();
    expect(processedToolTwo.parameters.properties.query.type).toBe('string');
    expect(processedToolTwo.parameters.properties.filters.type).toBe('array');
    expect(processedToolTwo.parameters.properties.filters.items.type).toBe('string');
    expect(processedToolTwo.parameters.required).toContain('query');
    expect(processedToolTwo.parameters.required).toContain('filters');

    // Verify all input tools exist in output
    expectResultKeysMatchInput(result as any, input as any);
  });
});
