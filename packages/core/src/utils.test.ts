import { jsonSchemaToZod } from 'json-schema-to-zod';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Logger } from './logger';
import { createTool } from './tools';
import {
  isVercelTool,
  makeCoreTool,
  maskStreamTags,
  resolveSerializedZodOutput,
  jsonSchemaPropertiesToTSTypes,
} from './utils';

describe('maskStreamTags', () => {
  async function* makeStream(chunks: string[]) {
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  async function collectStream(stream: AsyncIterable<string>): Promise<string> {
    let result = '';
    for await (const chunk of stream) {
      result += chunk;
    }
    return result;
  }

  it('should pass through text without tags', async () => {
    const input = ['Hello', ' ', 'world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello world');
  });

  it('should mask content between tags', async () => {
    const input = ['Hello ', '<secret>', 'sensitive', '</secret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks', async () => {
    const input = ['Hello ', '<sec', 'ret>', 'sensitive', '</sec', 'ret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start tag ', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensitive', '</sec', 'ret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start and end tag ', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensit', 'ive</sec', 'ret>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start and end tag where end tag has postfixed text', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensit', 'ive</sec', 'ret> w', 'orld'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello  world');
  });

  it('should handle tag split across chunks with other data included with the start and end tag where end tag has postfixed text AND the regular text includes <', async () => {
    const input = ['Hell', 'o <sec', 'ret>', 'sensit', 'ive</sec', 'ret>> 2 w', 'orld', ' 1 <'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello > 2 world 1 <');
  });

  it('should handle multiple tag pairs', async () => {
    const input = ['Start ', '<secret>hidden1</secret>', ' middle ', '<secret>hidden2</secret>', ' end'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Start  middle  end');
  });

  it('should not mask content for different tags', async () => {
    const input = ['Hello ', '<other>visible</other>', ' world'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Hello <other>visible</other> world');
  });

  it('should call lifecycle callbacks', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const onMask = vi.fn();

    const input = ['<secret>', 'hidden', '</secret>'];
    const masked = maskStreamTags(makeStream(input), 'secret', { onStart, onEnd, onMask });
    await collectStream(masked);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onMask).toHaveBeenCalledWith('hidden');
  });

  it('should handle malformed tags gracefully', async () => {
    const input = ['Start ', '<secret>no closing tag', ' more text', '<secret>another tag</secret>', ' end text'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Start  end text');
  });

  it('should handle empty tag content', async () => {
    const input = ['Before ', '<secret>', '</secret>', ' after', ' and more'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Before  after and more');
  });

  it('should handle whitespace around tags', async () => {
    const input = ['Before ', '  <secret>  ', 'hidden ', ' </secret>  ', ' after'];
    const masked = maskStreamTags(makeStream(input), 'secret');
    expect(await collectStream(masked)).toBe('Before    after');
  });
});

describe('isVercelTool', () => {
  it('should return true for a Vercel Tool', () => {
    const tool = {
      name: 'test',
      parameters: z.object({
        name: z.string(),
      }),
    };
    expect(isVercelTool(tool)).toBe(true);
  });

  it('should return false for a Mastra Tool', () => {
    const tool = createTool({
      id: 'test',
      description: 'test',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: async () => ({}),
    });
    expect(isVercelTool(tool)).toBe(false);
  });
});

describe('resolveSerializedZodOutput', () => {
  it('should return a zod object from a serialized zod object', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'], // Now name is required
    };

    const result = resolveSerializedZodOutput(jsonSchemaToZod(jsonSchema));

    // Test that the schema works as expected
    expect(() => result.parse({ name: 'test' })).not.toThrow();
    expect(() => result.parse({ name: 123 })).toThrow();
    expect(() => result.parse({})).toThrow();
  });
});

describe('makeCoreTool', () => {
  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  } as unknown as Logger;

  const mockOptions = {
    name: 'testTool',
    logger: mockLogger,
    description: 'Test tool description',
  };

  it('should convert a Vercel tool correctly', async () => {
    const vercelTool = {
      name: 'test',
      description: 'Test description',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
      execute: async () => ({ result: 'success' }),
    };

    const coreTool = makeCoreTool(vercelTool, mockOptions);

    expect(coreTool.description).toBe('Test description');
    expect(coreTool.parameters).toBeDefined();
    expect(typeof coreTool.execute).toBe('function');
    const result = await coreTool.execute?.({ name: 'test' }, { toolCallId: 'test-id', messages: [] });
    expect(result).toEqual({ result: 'success' });
  });

  it('should convert a Vercel tool with zod parameters correctly', async () => {
    const vercelTool = {
      name: 'test',
      description: 'Test description',
      parameters: z.object({ name: z.string() }),
      execute: async () => ({ result: 'success' }),
    };

    const coreTool = makeCoreTool(vercelTool, mockOptions);

    expect(coreTool.description).toBe('Test description');
    expect(coreTool.parameters).toBeDefined();
    expect(typeof coreTool.execute).toBe('function');
    const result = await coreTool.execute?.({ name: 'test' }, { toolCallId: 'test-id', messages: [] });
    expect(result).toEqual({ result: 'success' });
  });

  it('should convert a Mastra tool correctly', async () => {
    const mastraTool = createTool({
      id: 'test',
      description: 'Test description',
      inputSchema: z.object({ name: z.string() }),
      execute: async () => ({ result: 'success' }),
    });

    const coreTool = makeCoreTool(mastraTool, mockOptions);

    expect(coreTool.description).toBe('Test description');
    expect(coreTool.parameters).toBeDefined();
    expect(typeof coreTool.execute).toBe('function');
    const result = await coreTool.execute?.({ name: 'test' }, { toolCallId: 'test-id', messages: [] });
    expect(result).toEqual({ result: 'success' });
  });

  it('should handle tool execution errors correctly', async () => {
    const error = new Error('Test error');
    const mastraTool = createTool({
      id: 'test',
      description: 'Test description',
      inputSchema: z.object({ name: z.string() }),
      execute: async () => {
        throw error;
      },
    });

    const coreTool = makeCoreTool(mastraTool, mockOptions);
    expect(coreTool.execute).toBeDefined();

    if (coreTool.execute) {
      await expect(coreTool.execute({ name: 'test' }, { toolCallId: 'test-id', messages: [] })).rejects.toThrow(
        'Test error',
      );
      expect(mockLogger.error).toHaveBeenCalled();
    }
  });

  it('should handle undefined execute function', () => {
    const vercelTool = {
      name: 'test',
      description: 'Test description',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    };

    const coreTool = makeCoreTool(vercelTool, mockOptions);
    expect(coreTool.execute).toBeUndefined();
  });

  it('should have default parameters if no parameters are provided for Vercel tool', () => {
    const coreTool = makeCoreTool(
      {
        description: 'test',
        parameters: undefined,
        execute: async () => ({}),
      },
      mockOptions,
    );

    // Test the schema behavior instead of structure
    expect(() => coreTool.parameters.parse({})).not.toThrow();
    expect(() => coreTool.parameters.parse({ extra: 'field' })).not.toThrow();
  });

  it('should have default parameters if no parameters are provided for Mastra tool', () => {
    const coreTool = makeCoreTool(
      {
        id: 'test',
        description: 'test',
        inputSchema: undefined,
        execute: async () => ({}),
      },
      mockOptions,
    );

    // Test the schema behavior instead of structure
    expect(() => coreTool.parameters.parse({})).not.toThrow();
    expect(() => coreTool.parameters.parse({ extra: 'field' })).not.toThrow();
  });
});

it('should log correctly for Vercel tool execution', async () => {
  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;

  const vercelTool = {
    description: 'test',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({}),
  };

  const coreTool = makeCoreTool(vercelTool, {
    name: 'testTool',
    logger: mockLogger,
    agentName: 'testAgent',
  });

  await coreTool.execute?.({ name: 'test' }, { toolCallId: 'test-id', messages: [] });

  expect(mockLogger.debug).toHaveBeenCalledWith('[Agent:testAgent] - Executing tool testTool', expect.any(Object));
});

describe('jsonSchemaPropertiesToTSTypes', () => {
  it('should handle basic types correctly', () => {
    // String type
    const stringSchema = jsonSchemaPropertiesToTSTypes({ type: 'string', description: 'A string field' });
    expect(() => stringSchema.parse('test')).not.toThrow();
    expect(() => stringSchema.parse(123)).toThrow();

    // Number type
    const numberSchema = jsonSchemaPropertiesToTSTypes({ type: 'number', description: 'A number field' });
    expect(() => numberSchema.parse(123)).not.toThrow();
    expect(() => numberSchema.parse(123.45)).not.toThrow();
    expect(() => numberSchema.parse('123')).toThrow();

    // Integer type
    const integerSchema = jsonSchemaPropertiesToTSTypes({ type: 'integer', description: 'An integer field' });
    expect(() => integerSchema.parse(123)).not.toThrow();
    expect(() => integerSchema.parse(123.45)).toThrow();
    expect(() => integerSchema.parse('123')).toThrow();

    // Boolean type
    const booleanSchema = jsonSchemaPropertiesToTSTypes({ type: 'boolean', description: 'A boolean field' });
    expect(() => booleanSchema.parse(true)).not.toThrow();
    expect(() => booleanSchema.parse(false)).not.toThrow();
    expect(() => booleanSchema.parse('true')).toThrow();

    // Null type
    const nullSchema = jsonSchemaPropertiesToTSTypes({ type: 'null', description: 'A null field' });
    expect(() => nullSchema.parse(null)).not.toThrow();
    expect(() => nullSchema.parse(undefined)).toThrow();
  });

  it('should handle array types with different item types', () => {
    // Array of strings
    const stringArraySchema = jsonSchemaPropertiesToTSTypes({
      type: 'array',
      items: { type: 'string' },
      description: 'Array of strings',
    });
    expect(() => stringArraySchema.parse(['a', 'b', 'c'])).not.toThrow();
    expect(() => stringArraySchema.parse([1, 2, 3])).toThrow();

    // Array of numbers
    const numberArraySchema = jsonSchemaPropertiesToTSTypes({
      type: 'array',
      items: { type: 'number' },
      description: 'Array of numbers',
    });
    expect(() => numberArraySchema.parse([1, 2, 3])).not.toThrow();
    expect(() => numberArraySchema.parse(['1', '2'])).toThrow();

    // Array of objects
    const objectArraySchema = jsonSchemaPropertiesToTSTypes({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name'],
      },
    });
    expect(() => objectArraySchema.parse([{ name: 'John' }, { name: 'Jane', age: 25 }])).not.toThrow();
    expect(() => objectArraySchema.parse([{ age: 25 }])).toThrow();

    // Array without items defaults to an array of strings
    const arrayWithoutItemsSchema = jsonSchemaPropertiesToTSTypes({ type: 'array' });
    expect(() => arrayWithoutItemsSchema.parse([1, 2, 3])).toThrow();
    expect(() => arrayWithoutItemsSchema.parse(123)).toThrow();
    expect(() => arrayWithoutItemsSchema.parse(['1', '2', '3'])).not.toThrow();
  });

  it('should handle objects with required and optional fields', () => {
    const schema = jsonSchemaPropertiesToTSTypes({
      type: 'object',
      properties: {
        required_string: { type: 'string' },
        optional_number: { type: 'number' },
        required_boolean: { type: 'boolean' },
      },
      required: ['required_string', 'required_boolean'],
    });

    // Valid cases
    expect(() =>
      schema.parse({
        required_string: 'test',
        required_boolean: true,
        optional_number: 123,
      }),
    ).not.toThrow();

    expect(() =>
      schema.parse({
        required_string: 'test',
        required_boolean: false,
      }),
    ).not.toThrow();

    // Invalid cases
    expect(() =>
      schema.parse({
        required_string: 'test',
      }),
    ).toThrow();

    expect(() =>
      schema.parse({
        required_string: 123,
        required_boolean: true,
      }),
    ).toThrow();
  });

  it('should handle multiple types via type array', () => {
    const schema = jsonSchemaPropertiesToTSTypes({
      type: ['string', 'number'],
      description: 'Field that can be string or number',
    });

    expect(() => schema.parse('test')).not.toThrow();
    expect(() => schema.parse(123)).not.toThrow();
    expect(() => schema.parse(true)).toThrow();
  });

  // TODO: Add support for anyOf combinations
  it.skip('should handle anyOf combinations', () => {
    const schema = jsonSchemaPropertiesToTSTypes({
      anyOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            value: { type: 'number' },
          },
          required: ['value'],
        },
      ],
    });

    expect(() => schema.parse('test')).not.toThrow();
    expect(() => schema.parse({ value: 123 })).not.toThrow();
    expect(() => schema.parse({ value: 'test' })).toThrow();
    expect(() => schema.parse(true)).toThrow();
  });

  // TODO: Add support for allOf combinations
  it.skip('should handle allOf combinations', () => {
    const schema = jsonSchemaPropertiesToTSTypes({
      allOf: [
        {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        {
          type: 'object',
          properties: {
            age: { type: 'number' },
          },
          required: ['age'],
        },
      ],
    });

    expect(() => schema.parse({ name: 'John', age: 25 })).not.toThrow();
    expect(() => schema.parse({ name: 'John' })).toThrow();
    expect(() => schema.parse({ age: 25 })).toThrow();
  });

  it('should handle complex nested structures', () => {
    const schema = jsonSchemaPropertiesToTSTypes({
      type: 'object',
      properties: {
        id: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  values: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
                required: ['name', 'values'],
              },
            },
          },
          required: ['items'],
        },
      },
      required: ['id', 'data'],
    });

    // Valid complex nested structure
    expect(() =>
      schema.parse({
        id: '123',
        data: {
          items: [
            { name: 'item1', values: [1, 2, 3] },
            { name: 'item2', values: [4, 5, 6] },
          ],
        },
      }),
    ).not.toThrow();

    // Invalid cases
    expect(() =>
      schema.parse({
        id: '123',
        data: {
          items: [
            { name: 'item1', values: ['1', '2'] }, // values should be numbers
          ],
        },
      }),
    ).toThrow();

    expect(() =>
      schema.parse({
        id: '123',
        data: {
          items: [
            { values: [1, 2, 3] }, // missing required name
          ],
        },
      }),
    ).toThrow();
  });

  it('should handle empty or invalid schemas gracefully', () => {
    // Empty schema
    const emptySchema = jsonSchemaPropertiesToTSTypes({});
    expect(() => emptySchema.parse({})).not.toThrow();
    expect(() => emptySchema.parse({ any: 'thing' })).not.toThrow();

    // Schema without type
    const noTypeSchema = jsonSchemaPropertiesToTSTypes({ description: 'No type specified' });
    expect(() => noTypeSchema.parse({})).not.toThrow();

    // Schema with invalid type
    expect(() => jsonSchemaPropertiesToTSTypes({ type: 'invalid' })).toThrow();
  });
});
