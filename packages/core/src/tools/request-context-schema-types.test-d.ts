import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { createTool } from './tool';
import type { RequestContext } from '../request-context';

/**
 * Type tests to verify requestContextSchema properly types the execute function's context
 */
describe('requestContextSchema type inference', () => {
  it('should type requestContext based on requestContextSchema in execute function', () => {
    const tool = createTool({
      id: 'typed-tool',
      description: 'A tool with typed request context',
      requestContextSchema: z.object({
        userId: z.string(),
        apiKey: z.string(),
      }),
      execute: async (input, context) => {
        // Verify context.requestContext is typed
        expectTypeOf(context.requestContext).toEqualTypeOf<
          RequestContext<{ userId: string; apiKey: string }> | undefined
        >();

        // Verify get() returns the correct type
        const userId = context.requestContext?.get('userId');
        expectTypeOf(userId).toEqualTypeOf<string | undefined>();

        const apiKey = context.requestContext?.get('apiKey');
        expectTypeOf(apiKey).toEqualTypeOf<string | undefined>();

        // Verify .all returns the typed object
        const all = context.requestContext?.all;
        expectTypeOf(all).toEqualTypeOf<{ userId: string; apiKey: string } | undefined>();

        return { success: true };
      },
    });

    // Tool is created successfully with proper types
    expectTypeOf(tool.id).toEqualTypeOf<'typed-tool'>();
  });

  it('should allow unknown keys when no requestContextSchema is provided', () => {
    createTool({
      id: 'untyped-tool',
      description: 'A tool without request context schema',
      execute: async (input, context) => {
        // Without schema, requestContext should be RequestContext<unknown>
        expectTypeOf(context.requestContext).toEqualTypeOf<RequestContext<unknown> | undefined>();

        // get() should return unknown
        const value = context.requestContext?.get('anyKey');
        expectTypeOf(value).toEqualTypeOf<unknown>();

        return { success: true };
      },
    });
  });

  it('should type nested objects in requestContextSchema', () => {
    createTool({
      id: 'nested-tool',
      description: 'A tool with nested request context schema',
      requestContextSchema: z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
        }),
        settings: z.object({
          theme: z.enum(['light', 'dark']),
        }),
      }),
      execute: async (input, context) => {
        const user = context.requestContext?.get('user');
        expectTypeOf(user).toEqualTypeOf<{ id: string; name: string } | undefined>();

        const settings = context.requestContext?.get('settings');
        expectTypeOf(settings).toEqualTypeOf<{ theme: 'light' | 'dark' } | undefined>();

        return { success: true };
      },
    });
  });
});
