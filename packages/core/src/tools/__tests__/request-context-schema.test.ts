import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../tool';

describe('Tool requestContextSchema', () => {
  const requestContextSchema = z.object({
    userId: z.string(),
    apiKey: z.string(),
  });

  describe('validation', () => {
    it('should pass validation when requestContext matches schema', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should return validation error when requestContext is missing required fields', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext<{ userId: string }>();
      requestContext.set('userId', 'user-123');
      // Missing apiKey

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).not.toHaveBeenCalled();
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Request context validation failed');
      expect(result.message).toContain('apiKey');
    });

    it('should return validation error when requestContext has invalid field types', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext();
      requestContext.set('userId', 123 as any); // Wrong type
      requestContext.set('apiKey', 'key-456');

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).not.toHaveBeenCalled();
      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('Request context validation failed');
      expect(result.message).toContain('userId');
    });

    it('should include tool ID in error message', async () => {
      const tool = createTool({
        id: 'my-special-tool',
        description: 'A test tool',
        requestContextSchema,
        execute: async () => ({ success: true }),
      });

      const requestContext = new RequestContext();
      // Empty context, missing required fields

      const result = await tool.execute!({}, { requestContext });

      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('my-special-tool');
    });
  });

  describe('backwards compatibility', () => {
    it('should work without requestContextSchema', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        execute: executeFn,
      });

      const requestContext = new RequestContext();
      requestContext.set('anything', 'value');

      const result = await tool.execute!({}, { requestContext });

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should work without requestContext in context', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        execute: executeFn,
      });

      const result = await tool.execute!({}, {});

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should work when execute is called with no context', async () => {
      const executeFn = vi.fn().mockResolvedValue({ success: true });
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        execute: executeFn,
      });

      const result = await tool.execute!({}, undefined as any);

      expect(executeFn).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('typed requestContext access', () => {
    it('should provide typed requestContext in execute function', async () => {
      const schema = z.object({
        tenantId: z.string(),
        permissions: z.array(z.string()),
      });

      let capturedContext: any;
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        requestContextSchema: schema,
        execute: async (_, context) => {
          capturedContext = context;
          return { success: true };
        },
      });

      const requestContext = new RequestContext<{ tenantId: string; permissions: string[] }>();
      requestContext.set('tenantId', 'tenant-abc');
      requestContext.set('permissions', ['read', 'write']);

      await tool.execute!({}, { requestContext });

      // Verify the requestContext is passed through
      expect(capturedContext.requestContext).toBeDefined();
      expect(capturedContext.requestContext.get('tenantId')).toBe('tenant-abc');
      expect(capturedContext.requestContext.get('permissions')).toEqual(['read', 'write']);

      // Verify the .all getter works
      const all = capturedContext.requestContext.all;
      expect(all.tenantId).toBe('tenant-abc');
      expect(all.permissions).toEqual(['read', 'write']);
    });
  });

  describe('schema transformations', () => {
    const dateCodec = z.codec(z.string(), z.date(), {
      decode: value => new Date(value),
      encode: value => value.toISOString(),
    });

    it('should pass transformed values to execute', async () => {
      let capturedDate: unknown;
      const tool = createTool({
        id: 'transform-tool',
        description: 'A test tool',
        requestContextSchema: z.object({ date: dateCodec }),
        execute: async (_, context) => {
          capturedDate = context.requestContext.get('date');
          return { success: true };
        },
      });

      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');

      await tool.execute!({}, { requestContext });

      expect(capturedDate).toBeInstanceOf(Date);
      expect((capturedDate as Date).toISOString()).toBe('2026-08-17T00:00:00.000Z');
      expect(capturedDate).toEqual(new Date('2026-08-17T00:00:00.000Z'));
    });

    it('should validate input-form values when forwarding transformed context to a nested tool', async () => {
      const innerTool = createTool({
        id: 'inner-transform-tool',
        description: 'A nested tool',
        requestContextSchema: z.object({ date: dateCodec }),
        execute: async (_, { requestContext }) => ({
          dateIsDate: requestContext.get('date') instanceof Date,
          allDateIsDate: requestContext.all.date instanceof Date,
        }),
      });
      const outerTool = createTool({
        id: 'outer-transform-tool',
        description: 'A forwarding tool',
        requestContextSchema: z.object({ date: dateCodec }),
        execute: async (_, { requestContext }) => innerTool.execute!({}, { requestContext }),
      });
      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');

      const result = await outerTool.execute!({}, { requestContext });

      expect(result).toEqual({ dateIsDate: true, allDateIsDate: true });
      expect(requestContext.getRaw('date')).toBe('2026-08-17T00:00:00.000Z');
    });

    it.each(['set', 'setRaw'] as const)(
      'should encode transformed values written with %s before the next execution',
      async mutationMethod => {
        const capturedDates: string[] = [];
        const tool = createTool({
          id: 'transform-mutation-tool',
          description: 'A test tool',
          requestContextSchema: z.object({ date: dateCodec }),
          execute: async (_, { requestContext }) => {
            const date = requestContext.get('date');
            capturedDates.push(date.toISOString());

            if (capturedDates.length === 1) {
              requestContext[mutationMethod]('date', new Date('2026-08-18T00:00:00.000Z'));
            }

            return { success: true };
          },
        });
        const requestContext = new RequestContext();
        requestContext.set('date', '2026-08-17T00:00:00.000Z');

        const firstResult = await tool.execute!({}, { requestContext });
        const secondResult = await tool.execute!({}, { requestContext });

        expect(firstResult).toEqual({ success: true });
        expect(secondResult).toEqual({ success: true });
        expect(capturedDates).toEqual(['2026-08-17T00:00:00.000Z', '2026-08-18T00:00:00.000Z']);
        expect(requestContext.getRaw('date')).toBe('2026-08-18T00:00:00.000Z');
      },
    );

    it.each(['set', 'setRaw'] as const)(
      'should reject unencodable transformed values written with %s without corrupting the source',
      async mutationMethod => {
        let executions = 0;
        const tool = createTool({
          id: 'one-way-transform-mutation-tool',
          description: 'A tool with a one-way transform',
          requestContextSchema: z.object({ count: z.string().transform(Number) }),
          execute: async (_, { requestContext }) => {
            executions += 1;
            const count = requestContext.get('count');
            if (executions === 1) {
              requestContext[mutationMethod]('count', count + 1);
            }
            return { count };
          },
        });
        const requestContext = new RequestContext();
        requestContext.set('count', '1');

        await expect(tool.execute!({}, { requestContext })).rejects.toThrow(
          'the value is not valid schema input and cannot be encoded',
        );
        const secondResult = await tool.execute!({}, { requestContext });

        expect(secondResult).toEqual({ count: 1 });
        expect(requestContext.getRaw('count')).toBe('1');
      },
    );

    it('should not write decoded values when another required field prevents encoding', async () => {
      const tool = createTool({
        id: 'invalid-context-mutation-tool',
        description: 'A tool that makes its context invalid before a codec mutation',
        requestContextSchema: z.object({ date: dateCodec, mode: z.string() }),
        execute: async (_, { requestContext }) => {
          requestContext.delete('mode');
          requestContext.set('date', new Date('2026-08-18T00:00:00.000Z'));
          return { success: true };
        },
      });
      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');
      requestContext.set('mode', 'fast');

      await expect(tool.execute!({}, { requestContext })).rejects.toThrow(
        'the value is not valid schema input and cannot be encoded',
      );
      expect(requestContext.all).toEqual({ date: '2026-08-17T00:00:00.000Z' });

      const secondResult = await tool.execute!({}, { requestContext });
      expect(secondResult).toHaveProperty('error', true);
      expect(secondResult.message).toContain('mode');
      expect(secondResult.message).not.toContain('expected string, received Date');
    });

    it.each([undefined, {}])('should apply schema defaults when request context is missing', async context => {
      let capturedMode: string | undefined;
      const tool = createTool({
        id: 'default-tool',
        description: 'A test tool',
        requestContextSchema: z.object({ mode: z.string().default('fast') }),
        execute: async (_, { requestContext }) => {
          capturedMode = requestContext.get('mode');
          return { success: true };
        },
      });

      await tool.execute!({}, context as any);

      expect(capturedMode).toBe('fast');
    });

    it('should preserve values outside the schema without mutating transformed values in the source', async () => {
      const capturedValues: Array<{ date: unknown; traceId: unknown }> = [];
      const tool = createTool({
        id: 'transform-tool',
        description: 'A test tool',
        requestContextSchema: z.object({ date: dateCodec }),
        execute: async (_, { requestContext }) => {
          capturedValues.push({
            date: requestContext.get('date'),
            traceId: requestContext.getRaw('traceId'),
          });
          return { success: true };
        },
      });
      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');
      requestContext.set('traceId', 'trace-123');

      await tool.execute!({}, { requestContext });
      await tool.execute!({}, { requestContext });

      expect(capturedValues).toEqual([
        { date: new Date('2026-08-17T00:00:00.000Z'), traceId: 'trace-123' },
        { date: new Date('2026-08-17T00:00:00.000Z'), traceId: 'trace-123' },
      ]);
      expect(requestContext.get('date')).toBe('2026-08-17T00:00:00.000Z');
    });

    it('should write explicit mutations through to the source request context', async () => {
      const tool = createTool({
        id: 'mutation-tool',
        description: 'A test tool',
        requestContextSchema: z.object({ date: dateCodec, mode: z.string() }),
        execute: async (_, { requestContext }) => {
          requestContext.set('mode', 'slow');
          requestContext.setRaw('added', 'value');
          requestContext.delete('date');
          requestContext.deleteRaw('removed');
          return { success: true };
        },
      });
      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');
      requestContext.set('mode', 'fast');
      requestContext.set('removed', true);

      await tool.execute!({}, { requestContext });

      expect(requestContext.all).toEqual({ mode: 'slow', added: 'value' });
    });

    it('should clear the source request context when execute clears its view', async () => {
      const tool = createTool({
        id: 'clear-tool',
        description: 'A test tool',
        requestContextSchema: z.object({ date: dateCodec }),
        execute: async (_, { requestContext }) => {
          requestContext.clear();
          return { success: true };
        },
      });
      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');
      requestContext.set('traceId', 'trace-123');

      await tool.execute!({}, { requestContext });

      expect(requestContext.size()).toBe(0);
    });
  });

  describe('combined with inputSchema validation', () => {
    it('should validate both inputSchema and requestContextSchema', async () => {
      const inputSchema = z.object({
        query: z.string(),
      });

      const executeFn = vi.fn().mockResolvedValue({ result: 'found' });
      const tool = createTool({
        id: 'search-tool',
        description: 'A search tool',
        inputSchema,
        requestContextSchema,
        execute: executeFn,
      });

      const requestContext = new RequestContext<{ userId: string; apiKey: string }>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      const result = await tool.execute!({ query: 'test search' }, { requestContext });

      expect(executeFn).toHaveBeenCalledWith({ query: 'test search' }, expect.objectContaining({ requestContext }));
      expect(result).toEqual({ result: 'found' });
    });

    it('should fail on inputSchema validation before requestContextSchema validation', async () => {
      const inputSchema = z.object({
        query: z.string(),
      });

      const executeFn = vi.fn().mockResolvedValue({ result: 'found' });
      const tool = createTool({
        id: 'search-tool',
        description: 'A search tool',
        inputSchema,
        requestContextSchema,
        execute: executeFn,
      });

      // Invalid input and missing requestContext values
      const requestContext = new RequestContext();

      const result = await tool.execute!({ query: 123 as any }, { requestContext });

      expect(executeFn).not.toHaveBeenCalled();
      expect(result).toHaveProperty('error', true);
      // Input validation should fail first
      expect(result.message).toContain('Tool input validation failed');
    });
  });
});
