import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from './error';
import { ConsoleLogger } from './logger';
import { RequestContext } from './request-context';
import { toStandardSchema } from './schema';
import { createTool, isVercelTool } from './tools';
<<<<<<< fix/issue-14152
import { generateEmptyFromSchema, makeCoreTool, maskStreamTags, resolveSerializedZodOutput } from './utils';
=======
import { fetchWithRetry, makeCoreTool, maskStreamTags, resolveSerializedZodOutput } from './utils';
>>>>>>> main

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
  const mockOptions = {
    name: 'testTool',
    description: 'Test tool description',
    requestContext: new RequestContext(),
    tracingContext: {},
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
    const errorSpy = vi.spyOn(ConsoleLogger.prototype, 'error');
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
        MastraError,
      );
      expect(errorSpy).toHaveBeenCalled();
    }
    errorSpy.mockRestore();
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

  it('should preserve lifecycle hooks through createTool → makeCoreTool pipeline', () => {
    const onInputStart = vi.fn();
    const onInputDelta = vi.fn();
    const onInputAvailable = vi.fn();
    const onOutput = vi.fn();

    const tool = createTool({
      id: 'hook-test',
      description: 'Tool with hooks',
      inputSchema: z.object({ name: z.string() }),
      execute: async () => ({ ok: true }),
      onInputStart,
      onInputDelta,
      onInputAvailable,
      onOutput,
    });

    // Break 1 fix: Tool instance preserves hooks from createTool options
    expect(tool.onInputStart).toBe(onInputStart);
    expect(tool.onInputDelta).toBe(onInputDelta);
    expect(tool.onInputAvailable).toBe(onInputAvailable);
    expect(tool.onOutput).toBe(onOutput);

    // Break 2 fix: CoreToolBuilder.build() transfers hooks to CoreTool
    const coreTool = makeCoreTool(tool, mockOptions);
    expect((coreTool as any).onInputStart).toBe(onInputStart);
    expect((coreTool as any).onInputDelta).toBe(onInputDelta);
    expect((coreTool as any).onInputAvailable).toBe(onInputAvailable);
    expect((coreTool as any).onOutput).toBe(onOutput);
  });

  it('should not add hook properties when tool has no hooks', () => {
    const tool = createTool({
      id: 'no-hooks',
      description: 'Tool without hooks',
      inputSchema: z.object({ name: z.string() }),
      execute: async () => ({ ok: true }),
    });

    const coreTool = makeCoreTool(tool, mockOptions);

    expect((coreTool as any).onInputStart).toBeUndefined();
    expect((coreTool as any).onInputDelta).toBeUndefined();
    expect((coreTool as any).onInputAvailable).toBeUndefined();
    expect((coreTool as any).onOutput).toBeUndefined();
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

    const schema = toStandardSchema(coreTool.parameters);

    // Test the schema behavior instead of structure
    expect(() => schema['~standard'].validate({})).not.toThrow();
    expect(() => schema['~standard'].validate({ extra: 'field' })).not.toThrow();
  });
});

it('should log correctly for Vercel tool execution', async () => {
  const debugSpy = vi.spyOn(ConsoleLogger.prototype, 'debug');

  const vercelTool = {
    description: 'test',
    parameters: { type: 'object', properties: {} },
    execute: async () => ({}),
  };

  const coreTool = makeCoreTool(vercelTool, {
    name: 'testTool',
    agentName: 'testAgent',
    requestContext: new RequestContext(),
    tracingContext: {},
  });

  await coreTool.execute?.({ name: 'test' }, { toolCallId: 'test-id', messages: [] });

  expect(debugSpy).toHaveBeenCalledWith('[Agent:testAgent] - Executing tool testTool', expect.any(Object));

  debugSpy.mockRestore();
});

<<<<<<< fix/issue-14152
describe('generateEmptyFromSchema', () => {
  it('should handle a JSON string schema with flat properties', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
        tags: { type: 'array' },
        count: { type: 'integer' },
      },
    });
    expect(generateEmptyFromSchema(schema)).toEqual({
      name: '',
      age: 0,
      active: false,
      tags: [],
      count: 0,
    });
  });

  it('should handle a pre-parsed object schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({
      name: '',
      age: 0,
    });
  });

  it('should recurse into nested object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            preferences: {
              type: 'object',
              properties: {
                theme: { type: 'string' },
              },
            },
          },
        },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({
      user: {
        name: '',
        preferences: {
          theme: '',
        },
      },
    });
  });

  it('should respect default values', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', default: 'unknown' },
        count: { type: 'number', default: 42 },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({
      name: 'unknown',
      count: 42,
    });
  });

  it('should return {} for invalid JSON string', () => {
    expect(generateEmptyFromSchema('not json')).toEqual({});
  });

  it('should return {} for schema without properties', () => {
    expect(generateEmptyFromSchema(JSON.stringify({ type: 'object' }))).toEqual({});
  });

  it('should return {} for non-object type schema', () => {
    expect(generateEmptyFromSchema(JSON.stringify({ type: 'string' }))).toEqual({});
  });

  it('should return null for unknown property types', () => {
    const schema = {
      type: 'object',
      properties: {
        data: { type: 'unknown_type' },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({ data: null });
  });

  it('should handle deeply nested schemas from JSON string', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                value: { type: 'string' },
              },
            },
          },
        },
      },
    });
    expect(generateEmptyFromSchema(schema)).toEqual({
      level1: {
        level2: {
          value: '',
        },
      },
    });
  });

  it('should return {} for object property without nested properties', () => {
    const schema = {
      type: 'object',
      properties: {
        data: { type: 'object' },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({ data: {} });
=======
describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should use exponential backoff delays capped at 10 seconds', async () => {
    const delays: number[] = [];

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, delay?: number) => {
      if (delay && delay > 100) {
        delays.push(delay);
      }
      // Execute callback immediately so the test completes
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    // Use 5 retries so computed backoff 1000 * 2^4 = 16000 exceeds the 10000 cap
    await expect(fetchWithRetry('https://example.com', {}, 5)).rejects.toThrow();

    // Delays: 2000 (2^1), 4000 (2^2), 8000 (2^3), 10000 (2^4=16000 capped to 10000)
    expect(delays.length).toBe(4); // 5 max retries = 4 retry delays
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(10000);
    }
    expect(delays[0]).toBe(2000); // 1000 * 2^1
    expect(delays[1]).toBe(4000); // 1000 * 2^2
    expect(delays[2]).toBe(8000); // 1000 * 2^3
    expect(delays[3]).toBe(10000); // 1000 * 2^4 = 16000, capped at 10000
>>>>>>> main
  });
});
