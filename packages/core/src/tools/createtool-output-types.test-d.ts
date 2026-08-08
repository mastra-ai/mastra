import type { Schema as AISdkSchema } from '@internal/ai-sdk-v4';
import { jsonSchema } from '@mastra/schema-compat';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';

import { createTool } from './tool';
import type { InferToolOutput } from './ui-types';

/**
 * Regression tests for issue #12426: `createTool`'s `execute` callback return type
 * was typed as the post-transform output schema type (`z.output<T>`) instead of the
 * pre-transform type (`z.input<T>`). This is incorrect because transforms are applied
 * during validation after execute returns. These are type-level assertions only.
 */
describe('createTool execute return type inference (issue #12426)', () => {
  it('execute return type matches pre-transform shape when outputSchema uses .transform()', () => {
    const outputSchema = z.object({ name: z.string() }).transform(d => ({ ...d, upper: d.name.toUpperCase() }));

    const tool = createTool({
      id: 'transform-output',
      description: 'Test',
      outputSchema,
      execute: async () => ({ name: 'test' }),
    });

    expectTypeOf<InferToolOutput<typeof tool>>().toEqualTypeOf<{
      name: string;
      upper: string;
    }>();

    // The callback is checked against the pre-transform shape rather than unknown.
    createTool({
      id: 'transform-output-invalid',
      description: 'Test',
      outputSchema,
      // @ts-expect-error - `name` remains a string in the pre-transform shape.
      execute: async () => ({ name: 42 }),
    });

    createTool({
      id: 'transform-output-explicit',
      description: 'Test',
      outputSchema,
      execute: async () => ({ name: 'test' }),
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
      execute: async () => ({ id: '123', status: 'active' as const }),
    });
  });

  it('keeps typed AI SDK schema output input checking', () => {
    const outputSchema: AISdkSchema<{ a: string }> = jsonSchema<{ a: string }>({
      type: 'object',
      properties: { a: { type: 'string' } },
      required: ['a'],
    });

    createTool({
      id: 'typed-json-schema-output',
      description: 'Test',
      outputSchema,
      execute: async () => ({ a: 'value' }),
    });

    createTool({
      id: 'typed-json-schema-output-invalid',
      description: 'Test',
      outputSchema,
      // @ts-expect-error - the callback must return the typed schema shape.
      execute: async () => ({ wrong: 1 }),
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
