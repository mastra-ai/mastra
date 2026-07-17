/* eslint-disable @typescript-eslint/no-unused-vars */
import { assertType, describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';
import type { RequestContext } from '../request-context';
import type { PublicSchema } from '../schema';
import { Agent } from './agent';
import type { AgentExecutionOptions, PublicAgentExecutionOptions } from './agent.types';
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
        requestContextSchema: z.object({
          userId: z.string(),
          tenantId: z.string(),
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
        requestContextSchema: z.object({
          featureFlags: z.object({
            enableSearch: z.boolean(),
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

    it('should type requestContext in skills function based on requestContextSchema', () => {
      // No explicit TRequestContext generic — the type must be inferred from
      // requestContextSchema so a regression to RequestContext<unknown> fails.
      new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        model: {} as any,
        requestContextSchema: z.object({
          documentId: z.string(),
          userId: z.string(),
        }),
        instructions: 'You are a helpful assistant',
        skills: ({ requestContext }) => {
          // Verify requestContext is typed
          expectTypeOf(requestContext).toEqualTypeOf<RequestContext<{ documentId: string; userId: string }>>();

          // Verify get() returns the correct type
          const documentId = requestContext.get('documentId');
          expectTypeOf(documentId).toEqualTypeOf<string>();

          // Verify unknown keys are rejected
          // @ts-expect-error - key does not exist in the request context schema
          requestContext.get('nonexistentKey');

          return [];
        },
      });
    });
  });

  describe('Issue #16732: AgentExecutionOptions<undefined> should not require structuredOutput', () => {
    it('should allow AgentExecutionOptions<undefined> without structuredOutput', () => {
      assertType<AgentExecutionOptions<undefined>>({ maxSteps: 50 });
    });

    it('should allow PublicAgentExecutionOptions<undefined> without structuredOutput', () => {
      assertType<PublicAgentExecutionOptions<undefined>>({ maxSteps: 50 });
    });

    it('should allow AgentExecutionOptions<null> without structuredOutput', () => {
      assertType<AgentExecutionOptions<null>>({ maxSteps: 50 });
    });

    it('should still require structuredOutput for an object OUTPUT', () => {
      const schema = z.object({ value: z.string() });
      // @ts-expect-error structuredOutput is required when OUTPUT is an object
      assertType<AgentExecutionOptions<{ value: string }>>({ maxSteps: 50 });
      assertType<AgentExecutionOptions<{ value: string }>>({
        maxSteps: 50,
        structuredOutput: { schema },
      });
    });

    it('should not require structuredOutput for a nullable union (T | undefined)', () => {
      // NonNullable<string | undefined> is `string`, which is not an object type,
      // so structuredOutput stays optional for the nullable-union case.
      assertType<AgentExecutionOptions<string | undefined>>({ maxSteps: 50 });
    });
  });

  // Editor ownership is enforced via the `TEditor` generic inferred at
  // `new Agent({...})` from the literal `editor` property. Annotating a value
  // as the bare `AgentConfig` (default `TEditor`) intentionally does NOT narrow
  // ownership, so these tests construct agents to exercise inference.
  describe('editor config ownership', () => {
    it('requires instructions when editor is absent', () => {
      // @ts-expect-error - instructions is required when not owned by the editor
      new Agent({ id: 'a', name: 'A', model: {} as any });
    });

    it('requires instructions when editor is false (nothing owned)', () => {
      new Agent({ id: 'a', name: 'A', model: {} as any, editor: false, instructions: 'hi', tools: {} });

      // @ts-expect-error - instructions still required when editor is false
      new Agent({ id: 'a', name: 'A', model: {} as any, editor: false });
    });

    it('forbids instructions in code when editor owns instructions', () => {
      new Agent({ id: 'a', name: 'A', model: {} as any, editor: { instructions: true }, tools: {} });

      new Agent({
        id: 'a',
        name: 'A',
        model: {} as any,
        editor: { instructions: true },
        // @ts-expect-error - instructions are owned by the editor, code must not set them
        instructions: 'hi',
      });
    });

    it('forbids tools in code when editor owns tool membership', () => {
      new Agent({ id: 'a', name: 'A', model: {} as any, editor: { tools: true }, instructions: 'hi' });

      new Agent({
        id: 'a',
        name: 'A',
        model: {} as any,
        editor: { tools: true },
        instructions: 'hi',
        // @ts-expect-error - tool membership is owned by the editor, code must not set tools
        tools: {},
      });
    });

    it('keeps tools code-owned in descriptions-only mode', () => {
      // description-only editing leaves tool membership in code, so tools stay allowed
      new Agent({
        id: 'a',
        name: 'A',
        model: {} as any,
        editor: { tools: { description: true } },
        instructions: 'hi',
        tools: {},
      });
    });

    it('forbids both fields when editor owns instructions and tools', () => {
      new Agent({ id: 'a', name: 'A', model: {} as any, editor: { instructions: true, tools: true } });

      new Agent({
        id: 'a',
        name: 'A',
        model: {} as any,
        editor: { instructions: true, tools: true },
        // @ts-expect-error - both fields owned by the editor
        instructions: 'hi',
      });
    });
  });
});
