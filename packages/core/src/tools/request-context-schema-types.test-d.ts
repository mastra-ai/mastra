import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { RequestContext } from '../request-context';
import { createTool } from './tool';

/**
 * Type tests to verify requestContextSchema properly types the execute function's context.
 *
 * Note: Inside the execute callback, the requestContext type parameter is a
 * deferred conditional (derived from TRequestContextSchema via InferPublicSchema).
 * This means RequestContext's conditional get()/all methods can't fully resolve
 * the value types. The key guarantees are:
 * - requestContext is REQUIRED when requestContextSchema is defined
 * - requestContext is optional when no schema is provided
 * - External callers of tool.execute() must provide the correct requestContext
 */
describe('requestContextSchema type inference', () => {
  it('should make requestContext required when requestContextSchema is defined', () => {
    const tool = createTool({
      id: 'typed-tool',
      description: 'A tool with typed request context',
      requestContextSchema: z.object({
        userId: z.string(),
        apiKey: z.string(),
      }),
      execute: async (input, context) => {
        // requestContext is required (no ?. needed) when schema is defined
        const rc = context.requestContext;
        expectTypeOf(rc).not.toBeNullable();

        return { success: true };
      },
    });

    // Tool is created successfully with proper types
    expectTypeOf(tool.id).toEqualTypeOf<'typed-tool'>();

    // External callers must provide requestContext — empty object should fail
    // @ts-expect-error — missing requestContext
    void tool.execute?.({}, {});
  });

  it('should allow unknown keys when no requestContextSchema is provided', () => {
    const tool = createTool({
      id: 'untyped-tool',
      description: 'A tool without request context schema',
      execute: async (input, context) => {
        // Without schema, requestContext should be optional
        expectTypeOf(context.requestContext).toEqualTypeOf<RequestContext<unknown> | undefined>();

        // get() should return unknown
        const value = context.requestContext?.get('anyKey');
        expectTypeOf(value).toEqualTypeOf<unknown>();

        return { success: true };
      },
    });

    // Without schema, empty context object is allowed
    void tool.execute?.({}, {});
  });

  it('should make nested requestContext required', () => {
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
        // requestContext is required
        const rc = context.requestContext;
        expectTypeOf(rc).not.toBeNullable();

        return { success: true };
      },
    });
  });
});
