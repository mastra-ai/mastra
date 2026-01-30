/* eslint-disable @typescript-eslint/no-unused-vars */
import { assertType, describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { IRequestContext, RequestContext } from '../request-context';
import type { OutputSchema } from '../stream/base/schema';
import { Agent } from './agent';
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

      expectTypeOf(options.structuredOutput.schema).toExtend<NonNullable<OutputSchema<z.infer<typeof mySchema>>>>();
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

      // The schema should accept any OutputSchema type
      expectTypeOf(
        (config.defaultOptions as AgentExecutionOptions<z.infer<typeof mySchema>>).structuredOutput.schema!,
      ).toExtend<NonNullable<OutputSchema<z.infer<typeof mySchema>>>>();
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
      expectTypeOf<SchemaType>().toExtend<NonNullable<OutputSchema<any>>>();
    });
  });

  describe('requestContextSchema type inference', () => {
    it('should provide IRequestContext in instructions function', () => {
      // With the new design, DynamicArgument uses IRequestContext interface
      // This allows any RequestContext<T> to be passed, avoiding variance issues
      const config: AgentConfig<'test-agent', Record<string, never>, undefined> = {
        id: 'test-agent',
        name: 'Test Agent',
        model: {} as any,
        requestContextSchema: z.object({
          userId: z.string(),
          tenantId: z.string(),
        }),
        instructions: ({ requestContext }) => {
          // requestContext is IRequestContext (the interface without generics)
          expectTypeOf(requestContext).toEqualTypeOf<IRequestContext>();

          // get() returns unknown since IRequestContext doesn't have type info
          const userId = requestContext.get('userId');
          expectTypeOf(userId).toEqualTypeOf<unknown>();

          // .all returns Record<string, unknown>
          const all = requestContext.all;
          expectTypeOf(all).toEqualTypeOf<Record<string, unknown>>();

          return 'You are a helpful assistant';
        },
      };

      expectTypeOf(config.id).toEqualTypeOf<'test-agent'>();
    });

    it('should provide IRequestContext in tools function', () => {
      const config: AgentConfig<'test-agent', Record<string, never>, undefined> = {
        id: 'test-agent',
        name: 'Test Agent',
        model: {} as any,
        requestContextSchema: z.object({
          featureFlags: z.object({
            enableSearch: z.boolean(),
          }),
        }),
        instructions: 'You are a helpful assistant',
        tools: ({ requestContext }) => {
          // requestContext is IRequestContext (the interface without generics)
          expectTypeOf(requestContext).toEqualTypeOf<IRequestContext>();

          // get() returns unknown since IRequestContext doesn't have type info
          const flags = requestContext.get('featureFlags');
          expectTypeOf(flags).toEqualTypeOf<unknown>();

          return {};
        },
      };

      expectTypeOf(config.id).toEqualTypeOf<'test-agent'>();
    });

    it('should allow typed RequestContext to be assigned to IRequestContext parameter', () => {
      // This is the key benefit - typed RequestContext can be passed to functions
      // expecting IRequestContext, solving the variance issue
      type TypedContext = { userId: string; tenantId: string };

      // A function that accepts IRequestContext
      const fn = ({ requestContext }: { requestContext: IRequestContext }) => {
        return requestContext.get('userId');
      };

      // A typed RequestContext should be assignable
      const typedCtx = {} as RequestContext<TypedContext>;
      expectTypeOf(typedCtx).toMatchTypeOf<IRequestContext>();
    });
  });
});
