import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MastraError } from './error';
import { ConsoleLogger } from './logger';
import { RequestContext } from './request-context';
import { toStandardSchema } from './schema';
import { createTool, isVercelTool } from './tools';
import {
  ensureSerializable,
  fetchWithRetry,
  generateEmptyFromSchema,
  makeCoreTool,
  maskStreamTags,
  resolveSerializedZodOutput,
  safeStringify,
  selectFields,
  setNestedValue,
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
    const trackExceptionSpy = vi.spyOn(ConsoleLogger.prototype, 'trackException');
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
      expect(trackExceptionSpy).toHaveBeenCalled();
    }
    trackExceptionSpy.mockRestore();
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

  it('should propagate requireApproval from options to the built CoreTool', () => {
    const tool = createTool({
      id: 'dangerous-tool',
      description: 'Deletes something important',
      inputSchema: z.object({ target: z.string() }),
      requireApproval: true,
      execute: async ({ target }) => ({ deleted: target }),
    });

    const coreToolWithFlag = makeCoreTool(tool, {
      ...mockOptions,
      requireApproval: (tool as any).requireApproval,
    });
    expect((coreToolWithFlag as any).requireApproval).toBe(true);

    const coreToolWithoutFlag = makeCoreTool(tool, mockOptions);
    expect((coreToolWithoutFlag as any).requireApproval).toBe(false);
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

  expect(debugSpy).toHaveBeenCalledWith(
    'Executing tool',
    expect.objectContaining({ agent: 'testAgent', tool: 'testTool' }),
  );

  debugSpy.mockRestore();
});

describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mockRetryDelays() {
    const delays: number[] = [];

    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, delay?: number) => {
      if (delay && delay > 100) {
        delays.push(delay);
      }
      // Execute callback immediately so the test completes
      if (typeof fn === 'function') fn();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);

    return delays;
  }

  it('should return a successful response without retrying', async () => {
    const response = new Response('ok', { status: 200 });
    const mockFetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchWithRetry('https://example.com', { method: 'POST' }, 3)).resolves.toBe(response);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com', { method: 'POST' });
  });

  it('should retry a failed response and return a later success', async () => {
    const delays = mockRetryDelays();
    const response = new Response('ok', { status: 200 });
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('error', { status: 500, statusText: 'Server Error' }))
      .mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchWithRetry('https://example.com', {}, 3)).resolves.toBe(response);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([2000]);
  });

  it('should retry network failures until retries are exhausted', async () => {
    const delays = mockRetryDelays();
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchWithRetry('https://example.com', {}, 3)).rejects.toThrow('Network error');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([2000, 4000]);
  });

  it.each([404, 408, 429])('should preserve public retry behavior for %s responses by default', async status => {
    const delays = mockRetryDelays();
    const mockFetch = vi.fn().mockResolvedValue(new Response('error', { status }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchWithRetry('https://example.com/missing', {}, 2)).rejects.toThrow(`status: ${status}`);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([2000]);
  });

  it('should not retry a response when shouldRetryResponse returns false', async () => {
    const delays = mockRetryDelays();
    const mockFetch = vi.fn().mockResolvedValue(new Response('not found', { status: 404, statusText: 'Not Found' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchWithRetry('https://example.com/missing', {}, 3, {
        shouldRetryResponse: response => response.status >= 500,
      }),
    ).rejects.toThrow('status: 404 Not Found');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('should retry network errors even when the error message contains a 4xx status', async () => {
    const delays = mockRetryDelays();
    const response = new Response('ok', { status: 200 });
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('upstream status: 404')).mockResolvedValueOnce(response);
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      fetchWithRetry('https://example.com/transient', {}, 3, {
        shouldRetryResponse: response => response.status >= 500,
      }),
    ).resolves.toBe(response);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([2000]);
  });

  it('should throw the last response error after exhausting retries', async () => {
    const delays = mockRetryDelays();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('first', { status: 500, statusText: 'First Error' }))
      .mockResolvedValueOnce(new Response('second', { status: 503, statusText: 'Second Error' }));
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchWithRetry('https://example.com/flaky', {}, 2)).rejects.toThrow('status: 503 Second Error');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([2000]);
  });

  it('should use exponential backoff delays capped at 10 seconds', async () => {
    const delays = mockRetryDelays();
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
  });
});

describe('generateEmptyFromSchema', () => {
  it('should handle a JSON string schema', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    });
    expect(generateEmptyFromSchema(schema)).toEqual({ name: '', age: 0 });
  });

  it('should handle a pre-parsed object schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'integer' },
        active: { type: 'boolean' },
        tags: { type: 'array' },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({
      name: '',
      count: 0,
      active: false,
      tags: [],
    });
  });

  it('should recursively initialize nested object properties', () => {
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
                fontSize: { type: 'number' },
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
          fontSize: 0,
        },
      },
    });
  });

  it('should respect default values defined in the schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', default: 'unnamed' },
        score: { type: 'number', default: 100 },
        active: { type: 'boolean', default: true },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({
      name: 'unnamed',
      score: 100,
      active: true,
    });
  });

  it('should return {} for non-object schemas', () => {
    expect(generateEmptyFromSchema({ type: 'string' })).toEqual({});
    expect(generateEmptyFromSchema({ type: 'array' })).toEqual({});
  });

  it('should return {} for invalid input', () => {
    expect(generateEmptyFromSchema('not valid json')).toEqual({});
  });

  it('should return null for unknown property types', () => {
    const schema = {
      type: 'object',
      properties: {
        unknown: { type: 'custom_type' },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({ unknown: null });
  });

  it('should handle deeply nested objects (3+ levels)', () => {
    const schema = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                level3: { type: 'string' },
              },
            },
          },
        },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({
      level1: { level2: { level3: '' } },
    });
  });

  it('should treat object without properties as empty object', () => {
    const schema = {
      type: 'object',
      properties: {
        data: { type: 'object' },
      },
    };
    expect(generateEmptyFromSchema(schema)).toEqual({ data: {} });
  });
});

describe('safeStringify', () => {
  it('should stringify simple values', () => {
    expect(safeStringify({ a: 1, b: 'hello' })).toBe('{"a":1,"b":"hello"}');
    expect(safeStringify(null)).toBe('null');
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify('text')).toBe('"text"');
  });

  it('should handle circular references without throwing', () => {
    const obj: any = { name: 'test' };
    obj.self = obj;
    const result = safeStringify(obj);
    expect(result).toBe('{"name":"test","self":"[Circular]"}');
  });

  it('should handle deeply nested circular references', () => {
    const a: any = { id: 'a' };
    const b: any = { id: 'b', parent: a };
    a.child = b;
    const result = safeStringify(a);
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('a');
    expect(parsed.child.id).toBe('b');
    expect(parsed.child.parent).toBe('[Circular]');
  });

  it('should support space parameter', () => {
    expect(safeStringify({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });

  it('should preserve shared (non-circular) references by duplicating them', () => {
    const shared = { x: 1 };
    const obj = { a: shared, b: shared };
    const result = JSON.parse(safeStringify(obj));
    expect(result.a).toEqual({ x: 1 });
    expect(result.b).toEqual({ x: 1 });
  });

  it('should handle BigInt values without throwing', () => {
    const obj = { count: BigInt(42), name: 'test' };
    const result = safeStringify(obj);
    expect(JSON.parse(result)).toEqual({ count: '42', name: 'test' });
  });
});

describe('ensureSerializable', () => {
  it('should return primitives unchanged', () => {
    expect(ensureSerializable(null)).toBe(null);
    expect(ensureSerializable(42)).toBe(42);
    expect(ensureSerializable('text')).toBe('text');
    expect(ensureSerializable(true)).toBe(true);
  });

  it('should return serializable objects unchanged (same reference)', () => {
    const obj = { a: 1, b: [2, 3], c: { d: 'hello' } };
    const result = ensureSerializable(obj);
    expect(result).toBe(obj);
  });

  it('should strip circular references and return a new object', () => {
    const obj: any = { name: 'test', value: 42 };
    obj.self = obj;
    const result = ensureSerializable(obj) as any;
    expect(result).not.toBe(obj);
    expect(result.name).toBe('test');
    expect(result.value).toBe(42);
    expect(result.self).toBe('[Circular]');
    // Result should be JSON-serializable
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('should handle nested circular references between parent and child objects', () => {
    const properties: any = { color: 'red', size: 10 };
    const screen: any = { properties };
    properties.variantScreenInstance = screen;
    const obj = { screen, metadata: 'test' };

    const result = ensureSerializable(obj) as any;
    expect(result.metadata).toBe('test');
    expect(result.screen.properties.color).toBe('red');
    expect(result.screen.properties.variantScreenInstance).toBe('[Circular]');
    expect(() => JSON.stringify(result)).not.toThrow();
  });
});

describe('setNestedValue', () => {
  it('sets a simple key', () => {
    const obj: any = {};
    setNestedValue(obj, 'a', 1);
    expect(obj.a).toBe(1);
  });

  it('sets a nested key, creating intermediate objects', () => {
    const obj: any = {};
    setNestedValue(obj, 'a.b.c', 'hello');
    expect(obj.a.b.c).toBe('hello');
  });

  it('does not overwrite existing nested objects', () => {
    const obj: any = { a: { existing: true } };
    setNestedValue(obj, 'a.b', 1);
    expect(obj.a.existing).toBe(true);
    expect(obj.a.b).toBe(1);
  });

  it('rejects __proto__ as the final key', () => {
    const obj: any = {};
    setNestedValue(obj, '__proto__', { polluted: true });
    expect(({} as any).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(obj, '__proto__')).toBe(false);
  });

  it('rejects __proto__ in an intermediate path segment', () => {
    const obj: any = {};
    setNestedValue(obj, '__proto__.polluted', true);
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects constructor and prototype keys', () => {
    const obj: any = {};
    setNestedValue(obj, 'constructor.prototype.polluted', true);
    setNestedValue(obj, 'prototype.polluted', true);
    expect(({} as any).polluted).toBeUndefined();
  });
});

describe('selectFields', () => {
  it('extracts specified dot-path fields', () => {
    const src = { a: { b: 1, c: 2 }, d: 3 };
    expect(selectFields(src, ['a.b', 'd'])).toEqual({ a: { b: 1 }, d: 3 });
  });

  it('ignores unsafe keys in field list without polluting', () => {
    const src = { __proto__: { polluted: true } } as any;
    const result = selectFields(src, ['__proto__.polluted']);
    expect(result).toEqual({});
    expect(({} as any).polluted).toBeUndefined();
  });
});
