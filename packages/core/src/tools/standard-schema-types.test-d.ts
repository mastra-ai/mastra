import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { StandardSchemaV1 } from '../types/standard-schema';
import type { InferZodLikeSchema, InferZodLikeSchemaInput, ZodLikeSchema } from '../types/zod-compat';
import { createTool } from './tool';

describe('ZodLikeSchema type inference', () => {
  describe('with Zod schemas', () => {
    it('should infer types from Zod object schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number(),
      });

      type Inferred = InferZodLikeSchema<typeof zodSchema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ name: string; age: number }>();
    });

    it('should infer input types from Zod schema with transforms', () => {
      const zodSchema = z
        .object({
          value: z.string(),
        })
        .transform(data => ({ ...data, transformed: true }));

      type InferredInput = InferZodLikeSchemaInput<typeof zodSchema>;
      type InferredOutput = InferZodLikeSchema<typeof zodSchema>;

      // Input should be { value: string }
      expectTypeOf<InferredInput>().toEqualTypeOf<{ value: string }>();
      // Output should be { value: string; transformed: boolean }
      expectTypeOf<InferredOutput>().toEqualTypeOf<{ value: string; transformed: boolean }>();
    });

    it('should accept Zod schema as ZodLikeSchema', () => {
      const zodSchema = z.object({ name: z.string() });
      expectTypeOf(zodSchema).toMatchTypeOf<ZodLikeSchema>();
    });
  });

  describe('with Standard Schema', () => {
    // Create a mock Standard Schema type for testing
    type MockStandardSchema = StandardSchemaV1<{ input: string }, { output: number }> & {
      '~standard': {
        version: 1;
        vendor: 'mock';
        validate: (value: unknown) => { value: { output: number } };
        types: {
          input: { input: string };
          output: { output: number };
        };
      };
    };

    it('should accept Standard Schema as ZodLikeSchema', () => {
      // A mock that satisfies StandardSchemaV1
      const mockSchema: MockStandardSchema = {
        '~standard': {
          version: 1,
          vendor: 'mock',
          validate: () => ({ value: { output: 42 } }),
          types: {
            input: { input: 'test' },
            output: { output: 42 },
          },
        },
      };

      expectTypeOf(mockSchema).toMatchTypeOf<ZodLikeSchema>();
    });

    it('should infer output type from Standard Schema', () => {
      type Inferred = InferZodLikeSchema<MockStandardSchema>;
      expectTypeOf<Inferred>().toEqualTypeOf<{ output: number }>();
    });

    it('should infer input type from Standard Schema', () => {
      type InferredInput = InferZodLikeSchemaInput<MockStandardSchema>;
      expectTypeOf<InferredInput>().toEqualTypeOf<{ input: string }>();
    });
  });

  describe('createTool type inference', () => {
    it('should infer input types correctly with Zod schema', () => {
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
        execute: async inputData => {
          // inputData should be typed as { query: string; limit?: number }
          expectTypeOf(inputData).toEqualTypeOf<{ query: string; limit?: number | undefined }>();
          return { result: inputData.query };
        },
      });

      // The tool's inputSchema should be typed
      expectTypeOf(tool.inputSchema).not.toBeUndefined();
    });

    it('should infer output types correctly with output schema', () => {
      const tool = createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        execute: async inputData => {
          return { result: inputData.input };
        },
      });

      // The execute function return type should match outputSchema
      expectTypeOf(tool.execute).returns.resolves.toMatchTypeOf<{ result: string }>();
    });
  });
});
