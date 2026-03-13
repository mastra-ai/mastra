/* eslint-disable @typescript-eslint/no-unused-vars */
import { assertType, describe, expectTypeOf, it } from 'vitest';
import z3 from 'zod/v3';
import { z } from 'zod/v4';
import type { RequestContext } from '../request-context';
import type { PublicSchema } from '../schema';
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
      const options: AgentExecutionOptions<z.infer<typeof mySchema>> = {
        structuredOutput: {
          schema: mySchema,
        },
      };

      expectTypeOf(options.structuredOutput.schema).toExtend<NonNullable<PublicSchema<z.infer<typeof mySchema>>>>();
    });

    it('should allow Zod schema in defaultOptions.structuredOutput (AgentConfig)', () => {
      const mySchema = z.object({
        result: z.string(),
        confidence: z.number(),
      });

      // Issue #9657: This should compile without errors
      // When defaultOptions is used in AgentConfig, it should accept any valid OutputSchema
      // for the structuredOutput.schema property

      const config: Pick<AgentConfig<any, any, z.infer<typeof mySchema>>, 'defaultOptions'> = {
        defaultOptions: {
          structuredOutput: {
            schema: mySchema,
          },
        },
      };

      // The schema should accept any PublicSchema type
      expectTypeOf(
        (config.defaultOptions as AgentExecutionOptions<z.infer<typeof mySchema>>).structuredOutput.schema!,
      ).toExtend<NonNullable<PublicSchema<z.infer<typeof mySchema>>>>();
    });

    it('should accept PublicSchema types in structuredOutput.schema after fix', () => {
      // PublicSchema includes: ZodType (v3/v4), Schema, JSONSchema7, StandardSchemaWithJSON
      // After the fix, defaultOptions.structuredOutput.schema should accept all of these

      const zodSchema = z.object({ name: z.string() });

      // This tests that Zod schemas are valid PublicSchema types
      expectTypeOf<typeof zodSchema>().toExtend<PublicSchema>();

      // Test with a discriminated union (from the original issue)

      const zodDiscriminatedUnion = z.discriminatedUnion('status', [
        z.object({ status: z.literal('success'), data: z.string() }),
        z.object({ status: z.literal('error'), error: z.string() }),
      ]);
      expectTypeOf<typeof zodDiscriminatedUnion>().toExtend<PublicSchema>();
    });

    it('should allow any PublicSchema in AgentConfig.defaultOptions.structuredOutput.schema', () => {
      // The fix changes AgentConfig.defaultOptions to use AgentExecutionOptions<PublicSchema>
      // instead of AgentExecutionOptions (which defaults OUTPUT to undefined)

      // AgentExecutionOptions<PublicSchema> should have schema: PublicSchema
      type OptionsWithPublicSchema = AgentExecutionOptions<PublicSchema>;
      type StructuredOutputType = NonNullable<OptionsWithPublicSchema['structuredOutput']>;
      type SchemaType = StructuredOutputType['schema'];

      // After fix: SchemaType is `PublicSchema` (accepts Zod schemas, JSONSchema7, etc.)
      expectTypeOf<SchemaType>().toExtend<NonNullable<PublicSchema<any>>>();
    });
  });

  describe('requestContextSchema type inference', () => {
    it('should type requestContext in instructions function based on requestContextSchema', () => {
      const config: AgentConfig<
        'test-agent',
        Record<string, never>,
        undefined,
        { userId: string; tenantId: string }
      > = {
        id: 'test-agent',
        name: 'Test Agent',
        model: {} as any,
        requestContextSchema: z3.object({
          userId: z3.string(),
          tenantId: z3.string(),
        }),
        instructions: ({ requestContext }) => {
          // Verify requestContext is typed
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext<{ userId: string; tenantId: string }>>();

          // Verify get() returns the correct type
          const userId = requestContext.get('userId');
          expectTypeOf(userId).toEqualTypeOf<string>();

          // Verify .all returns the typed object
          const all = requestContext.all;
          expectTypeOf(all).toEqualTypeOf<{ userId: string; tenantId: string }>();

          return 'You are a helpful assistant';
        },
      };

      expectTypeOf(config.id).toEqualTypeOf<'test-agent'>();
    });

    it('should type requestContext in tools function based on requestContextSchema', () => {
      const config: AgentConfig<
        'test-agent',
        Record<string, never>,
        undefined,
        { featureFlags: { enableSearch: boolean } }
      > = {
        id: 'test-agent',
        name: 'Test Agent',
        model: {} as any,
        requestContextSchema: z3.object({
          featureFlags: z3.object({
            enableSearch: z3.boolean(),
          }),
        }),
        instructions: 'You are a helpful assistant',
        tools: ({ requestContext }) => {
          // Verify requestContext is typed
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext<{ featureFlags: { enableSearch: boolean } }>>();

          // Verify get() returns the correct type
          const flags = requestContext.get('featureFlags');
          expectTypeOf(flags).toEqualTypeOf<{ enableSearch: boolean }>();

          return {};
        },
      };

      expectTypeOf(config.id).toEqualTypeOf<'test-agent'>();
    });
  });
});
