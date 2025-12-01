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

    it('BUG: should allow Zod schema in defaultOptions.structuredOutput (AgentConfig)', () => {
      const mySchema = z.object({
        result: z.string(),
        confidence: z.number(),
      });

      // This is the core issue from #9657:
      // When defaultOptions is used in AgentConfig, it should accept any valid OutputSchema
      // for the structuredOutput.schema property, not just `undefined`
      //
      // BUG: The following code causes a TypeScript error:
      // "Type 'ZodObject<...>' is not assignable to type 'undefined'"
      //
      // This is because AgentConfig.defaultOptions uses AgentExecutionOptions without
      // a generic parameter, causing OUTPUT to default to `undefined`.
      //
      // EXPECTED BEHAVIOR: This should compile without errors
      // ACTUAL BEHAVIOR: TypeScript error - schema expects `undefined` not a Zod schema

      const config: Partial<AgentConfig> = {
        defaultOptions: {
          structuredOutput: {
            // @ts-expect-error - This line demonstrates the bug. Remove @ts-expect-error after fix.
            schema: mySchema, // BUG: "Type 'ZodObject<...>' is not assignable to type 'undefined'"
          },
        },
      };

      // After the fix, the schema should accept any OutputSchema type
      assertType<Partial<AgentConfig>>(config);
    });

    it('should accept OutputSchema types in structuredOutput.schema after fix', () => {
      // OutputSchema includes: ZodType, Schema, JSONSchema7, undefined
      // After the fix, defaultOptions.structuredOutput.schema should accept all of these

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const zodSchema = z.object({ name: z.string() });

      // This tests that Zod schemas are valid OutputSchema types
      expectTypeOf<typeof zodSchema>().toExtend<OutputSchema>();

      // Test with a discriminated union (from the original issue)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const zodDiscriminatedUnion = z.discriminatedUnion('status', [
        z.object({ status: z.literal('success'), data: z.string() }),
        z.object({ status: z.literal('error'), error: z.string() }),
      ]);
      expectTypeOf<typeof zodDiscriminatedUnion>().toExtend<OutputSchema>();
    });

    it('should demonstrate the root cause: unparameterized AgentExecutionOptions defaults OUTPUT to undefined', () => {
      // When AgentExecutionOptions is used without generic params, OUTPUT defaults to undefined
      // This is the root cause - the schema type becomes `undefined` instead of `OutputSchema`

      type DefaultOptions = AgentExecutionOptions; // No generic parameter
      type StructuredOutputType = NonNullable<DefaultOptions['structuredOutput']>;
      type SchemaType = StructuredOutputType['schema'];

      // BUG: SchemaType is `undefined` instead of `OutputSchema`
      // After fix, this assertion should be removed and the one below should pass
      expectTypeOf<SchemaType>().toEqualTypeOf<undefined>();

      // After fix, uncomment this line and remove the one above:
      // expectTypeOf<SchemaType>().toExtend<OutputSchema>();
    });
  });
});
