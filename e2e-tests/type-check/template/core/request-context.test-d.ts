import { assertType, describe, expectTypeOf, it } from 'vitest';
import { RequestContext } from '@mastra/core/request-context';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import type { ToolExecutionContext } from '@mastra/core/tools';
import { z as zv3 } from 'zod-v3';
import { z as zv4 } from 'zod-v4';

describe('RequestContext', () => {
  describe('typed context', () => {
    type MyContext = {
      userId: string;
      tier: 'premium' | 'standard';
      count: number;
    };

    it('should infer correct type for get() with typed keys', () => {
      const ctx = new RequestContext<MyContext>();

      expectTypeOf(ctx.get('userId')).toEqualTypeOf<string>();
      expectTypeOf(ctx.get('tier')).toEqualTypeOf<'premium' | 'standard'>();
      expectTypeOf(ctx.get('count')).toEqualTypeOf<number>();
    });

    it('should enforce correct value types in set()', () => {
      const ctx = new RequestContext<MyContext>();

      ctx.set('userId', 'abc');
      ctx.set('tier', 'premium');
      ctx.set('count', 42);

      // @ts-expect-error - wrong value type for 'count'
      ctx.set('count', 'not-a-number');

      // @ts-expect-error - unknown key
      ctx.set('unknown', 'value');
    });

    it('should return typed keys', () => {
      const ctx = new RequestContext<MyContext>();
      expectTypeOf(ctx.keys()).toEqualTypeOf<IterableIterator<keyof MyContext>>();
    });

    it('should return typed values', () => {
      const ctx = new RequestContext<MyContext>();
      expectTypeOf(ctx.values()).toEqualTypeOf<IterableIterator<string | number>>();
    });

    it('should return discriminated union entries for type narrowing', () => {
      const ctx = new RequestContext<MyContext>();
      const entries = ctx.entries();

      type ExpectedEntry = ['userId', string] | ['tier', 'premium' | 'standard'] | ['count', number];
      assertType<IterableIterator<ExpectedEntry>>(entries);

      for (const [key, value] of entries) {
        if (key === 'count') {
          expectTypeOf(value).toEqualTypeOf<number>();
        } else if (key === 'userId') {
          expectTypeOf(value).toEqualTypeOf<string>();
        } else {
          expectTypeOf(value).toEqualTypeOf<'premium' | 'standard'>();
        }
      }
    });

    it('should work with nested object types', () => {
      type Nested = {
        user: { id: string; name: string };
        settings: { theme: 'light' | 'dark' };
      };

      const ctx = new RequestContext<Nested>();

      expectTypeOf(ctx.get('user')).toEqualTypeOf<{ id: string; name: string }>();
      expectTypeOf(ctx.get('settings')).toEqualTypeOf<{ theme: 'light' | 'dark' }>();
    });
  });

  describe('untyped context', () => {
    it('should return unknown for get()', () => {
      const ctx = new RequestContext();
      expectTypeOf(ctx.get('anything')).toEqualTypeOf<unknown>();
    });

    it('should allow setting any key', () => {
      const ctx = new RequestContext();
      ctx.set('a', 'string');
      ctx.set('b', 42);
      ctx.set('c', { nested: true });
    });
  });
});

describe('Agent with requestContextSchema', () => {
  describe('zod v3 schema', () => {
    const requestContextSchema = zv3.object({
      userId: zv3.string(),
      tier: zv3.enum(['premium', 'standard']),
    });

    type RC = zv3.infer<typeof requestContextSchema>;

    it('should type dynamic instructions with typed requestContext', () => {
      const agent = new Agent({
        id: 'ctx-agent',
        name: 'Context Agent',
        model: 'openai/gpt-4o',
        requestContextSchema,
        instructions: ({ requestContext }) => {
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext<RC>>();
          expectTypeOf(requestContext.get('userId')).toEqualTypeOf<string>();
          expectTypeOf(requestContext.get('tier')).toEqualTypeOf<'premium' | 'standard'>();
          return 'You are helpful';
        },
      });
    });

    it('should type dynamic tools with typed requestContext', () => {
      const agent = new Agent({
        id: 'ctx-tools-agent',
        name: 'Context Tools Agent',
        instructions: 'Hello',
        model: 'openai/gpt-4o',
        requestContextSchema,
        tools: ({ requestContext }) => {
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext<RC>>();
          return {};
        },
      });
    });
  });

  describe('zod v4 schema', () => {
    const requestContextSchema = zv4.object({
      locale: zv4.string(),
      featureFlags: zv4.object({
        darkMode: zv4.boolean(),
      }),
    });

    type RC = zv4.infer<typeof requestContextSchema>;

    it('should type dynamic instructions with zod v4 requestContext', () => {
      const agent = new Agent({
        id: 'v4-ctx-agent',
        name: 'V4 Context Agent',
        model: 'openai/gpt-4o',
        requestContextSchema,
        instructions: ({ requestContext }) => {
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext<RC>>();
          expectTypeOf(requestContext.get('locale')).toEqualTypeOf<string>();
          expectTypeOf(requestContext.get('featureFlags')).toEqualTypeOf<{ darkMode: boolean }>();
          return 'You are helpful';
        },
      });
    });
  });
});

describe('Tool with requestContextSchema', () => {
  describe('zod v3 schema', () => {
    it('should type requestContext in execute context', () => {
      const requestContextSchema = zv3.object({
        apiKey: zv3.string(),
        region: zv3.enum(['us', 'eu']),
      });

      const tool = createTool({
        id: 'ctx-tool',
        description: 'Tool with request context',
        requestContextSchema,
        inputSchema: zv3.object({ query: zv3.string() }),
        execute: async (inputData, context) => {
          expectTypeOf(inputData).toEqualTypeOf<{ query: string }>();

          // requestContext should be typed based on the schema
          if (context.requestContext) {
            expectTypeOf(context.requestContext.get('apiKey')).toEqualTypeOf<string>();
            expectTypeOf(context.requestContext.get('region')).toEqualTypeOf<'us' | 'eu'>();
          }

          return { result: 'done' };
        },
      });
    });

    it('should type ToolExecutionContext with TRequestContext', () => {
      type RC = { token: string; debug: boolean };
      type Ctx = ToolExecutionContext<unknown, unknown, RC>;

      expectTypeOf<Ctx['requestContext']>().toEqualTypeOf<RequestContext<RC> | undefined>();
    });
  });

  describe('zod v4 schema', () => {
    it('should type requestContext in execute context with zod v4', () => {
      const requestContextSchema = zv4.object({
        sessionId: zv4.string(),
        permissions: zv4.array(zv4.string()),
      });

      const tool = createTool({
        id: 'v4-ctx-tool',
        description: 'Tool with v4 request context',
        requestContextSchema,
        execute: async (_, context) => {
          if (context.requestContext) {
            expectTypeOf(context.requestContext.get('sessionId')).toEqualTypeOf<string>();
            expectTypeOf(context.requestContext.get('permissions')).toEqualTypeOf<string[]>();
          }

          return {};
        },
      });
    });
  });

  describe('tool without requestContextSchema', () => {
    it('should default requestContext to untyped', () => {
      const tool = createTool({
        id: 'no-ctx-tool',
        description: 'Tool without request context schema',
        execute: async (_, context) => {
          if (context.requestContext) {
            // Without a schema, get() returns unknown
            expectTypeOf(context.requestContext.get('anything')).toEqualTypeOf<unknown>();
          }
          return {};
        },
      });
    });
  });
});
