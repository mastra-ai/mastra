/* eslint-disable @typescript-eslint/no-unused-vars */
import { assertType, describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { OutputSchema } from '../stream/base/schema';
import type { AgentExecutionOptions } from './agent.types';
import type { AgentConfig } from './types';

/**
 * Type tests for Agent configuration types
 *
 * Issue #9657: defaultOptions.structuredOutput should accept Zod schemas
 */
describe('Agent Type Tests', () => {
  describe('Issue #9657: defaultOptions.structuredOutput should accept Zod schemas', () => {
    it('should allow Zod schema in AgentExecutionOptions.structuredOutput when OUTPUT is specified', () => {
      const mySchema = z.object({
        status: z.enum(['error', 'success', 'pending']),
        message: z.string(),
      });

      // When OUTPUT is explicitly specified, structuredOutput.schema should accept that schema
      // This works correctly because the generic parameter is specified
      const options: AgentExecutionOptions<typeof mySchema> = {
        structuredOutput: {
          schema: mySchema,
        },
      };

      expectTypeOf(options.structuredOutput?.schema).toEqualTypeOf<typeof mySchema | undefined>();
    });

    it('should allow Zod schema in defaultOptions.structuredOutput (AgentConfig)', () => {
      const mySchema = z.object({
        result: z.string(),
        confidence: z.number(),
      });

      // Issue #9657: This should compile without errors
      // When defaultOptions is used in AgentConfig, it should accept any valid OutputSchema
      // for the structuredOutput.schema property

      const config: Partial<AgentConfig> = {
        defaultOptions: {
          structuredOutput: {
            schema: mySchema,
          },
        },
      };

      // The schema should accept any OutputSchema type
      assertType<Partial<AgentConfig>>(config);
    });

    it('should accept OutputSchema types in structuredOutput.schema after fix', () => {
      // OutputSchema includes: ZodType, Schema, JSONSchema7, undefined
      // After the fix, defaultOptions.structuredOutput.schema should accept all of these

      const zodSchema = z.object({ name: z.string() });

      // This tests that Zod schemas are valid OutputSchema types
      expectTypeOf<typeof zodSchema>().toExtend<OutputSchema>();

      // Test with a discriminated union (from the original issue)

      const zodDiscriminatedUnion = z.discriminatedUnion('status', [
        z.object({ status: z.literal('success'), data: z.string() }),
        z.object({ status: z.literal('error'), error: z.string() }),
      ]);
      expectTypeOf<typeof zodDiscriminatedUnion>().toExtend<OutputSchema>();
    });

    it('should allow any OutputSchema in AgentConfig.defaultOptions.structuredOutput.schema', () => {
      // The fix changes AgentConfig.defaultOptions to use AgentExecutionOptions<OutputSchema>
      // instead of AgentExecutionOptions (which defaults OUTPUT to undefined)

      // AgentExecutionOptions<OutputSchema> should have schema: OutputSchema
      type OptionsWithOutputSchema = AgentExecutionOptions<OutputSchema>;
      type StructuredOutputType = NonNullable<OptionsWithOutputSchema['structuredOutput']>;
      type SchemaType = StructuredOutputType['schema'];

      // After fix: SchemaType is `OutputSchema` (accepts Zod schemas, JSONSchema7, etc.)
      expectTypeOf<SchemaType>().toEqualTypeOf<OutputSchema>();
    });
  });
});
