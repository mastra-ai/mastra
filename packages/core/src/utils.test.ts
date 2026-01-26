import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraError } from './error';
import { ConsoleLogger } from './logger';
import { RequestContext } from './request-context';
import type { InternalCoreTool } from './tools';
import { createTool, isVercelTool } from './tools';
import { makeCoreTool, maskStreamTags, normalizeRoutePath, resolveSerializedZodOutput } from './utils';

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
      const result = await coreTool.execute({ name: 'test' }, { toolCallId: 'test-id', messages: [] });
      expect(result).toBeInstanceOf(MastraError);
      expect(result.message).toBe('Test error');
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
    expect(() => (coreTool as InternalCoreTool).parameters.validate({})).not.toThrow();
    expect(() => (coreTool as InternalCoreTool).parameters.validate({ extra: 'field' })).not.toThrow();
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

describe('normalizeRoutePath', () => {
  describe('special cases', () => {
    it('should return empty string for root path', () => {
      expect(normalizeRoutePath('/')).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(normalizeRoutePath('')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(normalizeRoutePath('  /api  ')).toBe('/api');
      expect(normalizeRoutePath('  api  ')).toBe('/api');
    });
  });

  describe('basic normalization', () => {
    it('should add leading slash when missing', () => {
      expect(normalizeRoutePath('api')).toBe('/api');
    });

    it('should preserve leading slash', () => {
      expect(normalizeRoutePath('/api')).toBe('/api');
    });

    it('should remove trailing slash', () => {
      expect(normalizeRoutePath('/api/')).toBe('/api');
    });

    it('should add leading slash and remove trailing slash', () => {
      expect(normalizeRoutePath('api/')).toBe('/api');
    });

    it('should handle nested paths', () => {
      expect(normalizeRoutePath('/api/v1')).toBe('/api/v1');
      expect(normalizeRoutePath('api/v1')).toBe('/api/v1');
      expect(normalizeRoutePath('/api/v1/')).toBe('/api/v1');
    });
  });

  describe('multiple slashes normalization', () => {
    it('should normalize double slashes to single slash', () => {
      expect(normalizeRoutePath('//api')).toBe('/api');
    });

    it('should normalize multiple consecutive slashes', () => {
      expect(normalizeRoutePath('///api')).toBe('/api');
    });

    it('should normalize slashes in the middle of path', () => {
      expect(normalizeRoutePath('/api//v1')).toBe('/api/v1');
    });

    it('should normalize multiple slashes to empty string', () => {
      expect(normalizeRoutePath('///')).toBe('');
      expect(normalizeRoutePath('//')).toBe('');
    });
  });

  describe('validation', () => {
    it('should throw error for path traversal', () => {
      expect(() => normalizeRoutePath('../secret')).toThrow(/cannot contain/);
      expect(() => normalizeRoutePath('/api/../secret')).toThrow(/cannot contain/);
    });

    it('should throw error for query parameters', () => {
      expect(() => normalizeRoutePath('/api?query=1')).toThrow(/cannot contain/);
    });

    it('should throw error for hash fragments', () => {
      expect(() => normalizeRoutePath('/api#section')).toThrow(/cannot contain/);
    });
  });
});
