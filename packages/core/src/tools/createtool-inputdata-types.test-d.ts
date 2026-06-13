import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import z3 from 'zod/v3';
import { createTool } from './tool';

/**
 * Type tests for issue #16528:
 * `createTool`'s `execute` callback `inputData` parameter should be typed
 * as the inferred schema type, not `any`.
 *
 * Before the fix, TypeScript deferred `InferSchema<TInputSchema>` as a
 * conditional type when `inputSchema` and `execute` were resolved in the
 * same object literal, causing `inputData` to fall back to `any`.
 *
 * The fix adds Zod v4 and v3 overloads that bind `TInput` directly from
 * `ZodType<TInput>`, so the type is available when TypeScript processes
 * the `execute` callback.
 */
describe('createTool inputData type inference (issue #16528)', () => {
  it('should infer inputData type from zod v4 inputSchema — not any', () => {
    createTool({
      id: 'test',
      description: 'test',
      inputSchema: z.object({ name: z.string(), age: z.number() }),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string; age: number }>();
        return {};
      },
    });
  });

  it('should infer inputData type from zod v3 inputSchema — not any', () => {
    createTool({
      id: 'test',
      description: 'test',
      inputSchema: z3.object({ name: z3.string(), age: z3.number() }),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string; age: number }>();
        return {};
      },
    });
  });

  it('should infer inputData with optional fields correctly (zod v4)', () => {
    createTool({
      id: 'test',
      description: 'test',
      inputSchema: z.object({ name: z.string(), email: z.string().optional() }),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string; email?: string | undefined }>();
        return {};
      },
    });
  });

  it('should infer inputData with enum fields correctly (zod v4)', () => {
    createTool({
      id: 'test',
      description: 'test',
      inputSchema: z.object({ op: z.enum(['add', 'sub']), a: z.number(), b: z.number() }),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ op: 'add' | 'sub'; a: number; b: number }>();
        return {};
      },
    });
  });

  it('should infer outputData type from zod v4 outputSchema', () => {
    createTool({
      id: 'test',
      description: 'test',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ greeting: z.string() }),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string }>();
        return { greeting: `Hello ${inputData.name}` };
      },
    });
  });
});
