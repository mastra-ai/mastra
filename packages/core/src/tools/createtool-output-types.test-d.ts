import { describe, it, expectTypeOf } from 'vitest';
import { z } from 'zod/v4';

import { createTool } from './tool';

/**
 * Regression tests for issue #12426: `createTool`'s `execute` callback return type
 * was typed as the post-transform output schema type (`z.output<T>`) instead of the
 * pre-transform type (`z.input<T>`). This is incorrect because transforms are applied
 * during validation after execute returns. These are type-level assertions only.
 */
describe('createTool execute return type inference (issue #12426)', () => {
  it('execute return type matches pre-transform shape when outputSchema uses .transform()', () => {
    const outputSchema = z
      .object({ name: z.string() })
      .transform(d => ({ ...d, upper: d.name.toUpperCase() }));

    createTool({
      id: 'transform-output',
      description: 'Test',
      outputSchema,
      execute: async () => {
        // Should accept pre-transform type (without the 'upper' field)
        return { name: 'test' };
      },
    });

    createTool({
      id: 'transform-output-explicit',
      description: 'Test',
      outputSchema,
      execute: async () => {
        const result: { name: string } = { name: 'test' };
        expectTypeOf(result).toEqualTypeOf<{ name: string }>();
        return result;
      },
    });
  });

  it('execute return type matches the plain shape when outputSchema has no transform', () => {
    const outputSchema = z.object({
      id: z.string(),
      status: z.enum(['active', 'inactive']),
    });

    createTool({
      id: 'plain-output',
      description: 'Test',
      outputSchema,
      execute: async () => {
        const result: { id: string; status: 'active' | 'inactive' } = {
          id: '123',
          status: 'active',
        };
        expectTypeOf(result).toEqualTypeOf<{ id: string; status: 'active' | 'inactive' }>();
        return result;
      },
    });
  });

  it('execute allows void/undefined returns when outputSchema is not provided', () => {
    createTool({
      id: 'no-output',
      description: 'Test',
      execute: async () => {
        // Should allow void/undefined
        return undefined;
      },
    });

    createTool({
      id: 'no-output-implicit',
      description: 'Test',
      execute: async () => {
        // Should allow returning nothing
      },
    });
  });
});
