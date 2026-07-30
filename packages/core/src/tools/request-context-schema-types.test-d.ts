import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { RequestContext } from '../request-context';
import { createTool, Tool } from './tool';

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
        // The runtime always provides requestContext (and validates it against
        // the schema before execute runs), so it is non-optional here.
        expectTypeOf(context.requestContext).toEqualTypeOf<RequestContext<{ userId: string; apiKey: string }>>();

        // Verify get() returns the correct type without null-checking
        const userId = context.requestContext.get('userId');
        expectTypeOf(userId).toEqualTypeOf<string>();

        const apiKey = context.requestContext.get('apiKey');
        expectTypeOf(apiKey).toEqualTypeOf<string>();

        // Verify .all returns the typed object
        const all = context.requestContext.all;
        expectTypeOf(all).toEqualTypeOf<{ userId: string; apiKey: string }>();

        // Verify unknown keys are rejected
        // @ts-expect-error - key does not exist in the request context schema
        context.requestContext.get('nonexistentKey');

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
        // Without schema, requestContext is still always provided at runtime,
        // just untyped: RequestContext<unknown>
        expectTypeOf(context.requestContext).toEqualTypeOf<RequestContext<unknown>>();

        // get() should return unknown
        const value = context.requestContext.get('anyKey');
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
        const user = context.requestContext.get('user');
        expectTypeOf(user).toEqualTypeOf<{ id: string; name: string }>();

        const settings = context.requestContext.get('settings');
        expectTypeOf(settings).toEqualTypeOf<{ theme: 'light' | 'dark' }>();

        return { success: true };
      },
    });
  });

  it('should preserve readonly properties from a readonly requestContextSchema', () => {
    createTool({
      id: 'document-tool',
      description: 'A tool with document request metadata',
      requestContextSchema: z
        .object({
          documentId: z.string(),
          userId: z.string(),
        })
        .readonly(),
      execute: async (input, context) => {
        expectTypeOf(context.requestContext).toEqualTypeOf<
          RequestContext<{ readonly documentId: string; readonly userId: string }>
        >();

        const documentId = context.requestContext.get('documentId');
        expectTypeOf(documentId).toEqualTypeOf<string>();

        const userId = context.requestContext.get('userId');
        expectTypeOf(userId).toEqualTypeOf<string>();

        return { success: true };
      },
    });
  });

  it('should type requestContext in execute when constructed via new Tool()', () => {
    new Tool({
      id: 'typed-class-tool',
      description: 'A tool constructed directly with a typed request context',
      requestContextSchema: z.object({
        userId: z.string(),
        apiKey: z.string(),
      }),
      execute: async (input, context) => {
        expectTypeOf(context.requestContext).toEqualTypeOf<RequestContext<{ userId: string; apiKey: string }>>();

        const userId = context.requestContext.get('userId');
        expectTypeOf(userId).toEqualTypeOf<string>();

        const all = context.requestContext.all;
        expectTypeOf(all).toEqualTypeOf<{ userId: string; apiKey: string }>();

        // @ts-expect-error - key does not exist in the request context schema
        context.requestContext.get('nonexistentKey');

        return { success: true };
      },
    });
  });
});
