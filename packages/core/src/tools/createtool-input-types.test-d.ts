import { jsonSchema } from '@mastra/schema-compat';
import { describe, it, expectTypeOf } from 'vitest';
import zDefault from 'zod';
import z3 from 'zod/v3';
import { z } from 'zod/v4';

import { createTool } from './tool';

/**
 * Regression tests for issue #16528: `createTool`'s `execute` callback `inputData`
 * parameter was typed as `any` regardless of the provided `inputSchema`, instead of
 * the inferred schema type. These are type-level assertions only.
 */
describe('createTool execute inputData type inference (issue #16528)', () => {
  it('infers inputData with the default `import z from "zod"` (exact issue repro)', () => {
    const schema = zDefault.object({ name: zDefault.string() });
    createTool({
      id: 'test',
      description: 'test',
      inputSchema: schema,
      execute: async inputData => {
        expectTypeOf(inputData).not.toBeAny();
        expectTypeOf(inputData).toEqualTypeOf<{ name: string }>();
        // @ts-expect-error - `this_does_not_exist` is not a property of the inferred input type
        inputData.this_does_not_exist;
        return {};
      },
    });
  });

  it('infers inputData from a Zod inputSchema and does not widen to any', () => {
    createTool({
      id: 'typed-input',
      description: 'Test',
      inputSchema: z.object({ name: z.string(), age: z.number() }),
      execute: async inputData => {
        expectTypeOf(inputData).not.toBeAny();
        expectTypeOf(inputData).toEqualTypeOf<{ name: string; age: number }>();
        expectTypeOf(inputData.name).toBeString();
        expectTypeOf(inputData.age).toBeNumber();
        // @ts-expect-error - `missing` is not a property of the inferred input type
        inputData.missing;
        return undefined;
      },
    });
  });

  it('infers optional fields from the inputSchema', () => {
    createTool({
      id: 'optional-input',
      description: 'Test',
      inputSchema: z.object({ name: z.string(), email: z.string().optional() }),
      execute: async inputData => {
        expectTypeOf(inputData).not.toBeAny();
        expectTypeOf(inputData).toEqualTypeOf<{ name: string; email?: string | undefined }>();
        return undefined;
      },
    });
  });

  it('preserves Zod v3 input and output inference', () => {
    createTool({
      id: 'zod-v3',
      description: 'Test',
      inputSchema: z3.object({ name: z3.string() }),
      outputSchema: z3.object({ greeting: z3.string() }),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string }>();
        return { greeting: `Hello ${inputData.name}` };
      },
    });

    createTool({
      id: 'zod-v3-invalid-output',
      description: 'Test',
      outputSchema: z3.object({ greeting: z3.string() }),
      // @ts-expect-error - outputSchema requires greeting to be a string
      execute: async () => ({ greeting: 42 }),
    });
  });

  it('infers the parsed output from a transformed Zod v4 input schema', () => {
    createTool({
      id: 'transformed-input',
      description: 'Test',
      inputSchema: z.object({ name: z.string() }).transform(({ name }) => ({ nameLength: name.length })),
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ nameLength: number }>();
        return undefined;
      },
    });
  });

  it('rejects objects that do not match a supported schema shape', () => {
    createTool({
      id: 'invalid-schema',
      description: 'Test',
      // @ts-expect-error - arbitrary objects are not supported schemas
      inputSchema: { unsupported: true },
    });
  });

  it('does not break tools without an inputSchema', () => {
    createTool({
      id: 'no-input',
      description: 'Test',
      execute: async inputData => {
        expectTypeOf(inputData).toBeUnknown();
        return undefined;
      },
    });
  });
});

describe('createTool structural Zod schema inference (issue #23658)', () => {
  it('accepts the minimal structural shape used to identify Zod schemas', () => {
    const structuralZodSchema = {
      _output: {} as { name: string },
      _input: {} as { name: string },
      _def: {},
      parse: (_data: unknown) => ({ name: 'Grace' }),
      safeParse: (_data: unknown): unknown => ({ success: true, data: { name: 'Grace' } }),
    };

    createTool({
      id: 'structural-zod-schema',
      description: 'Test',
      inputSchema: structuralZodSchema,
      execute: async inputData => {
        expectTypeOf(inputData).toEqualTypeOf<{ name: string }>();
        return undefined;
      },
    });
  });
});

describe('createTool accepts jsonSchema() without cast (issue #16384)', () => {
  it('accepts a jsonSchema() schema without requiring "as never" cast', () => {
    createTool({
      id: 'json-schema-input',
      description: 'Test',
      inputSchema: jsonSchema<{ city: string }>({
        type: 'object',
        properties: { city: { type: 'string' } },
        required: ['city'],
      }),
      execute: async _inputData => {
        return undefined;
      },
    });
  });

  it('accepts a plain JSONSchema7 object without cast', () => {
    createTool({
      id: 'plain-json-schema',
      description: 'Test',
      inputSchema: { type: 'object' as const, properties: { name: { type: 'string' as const } } },
      execute: async _inputData => {
        return undefined;
      },
    });
  });
});
