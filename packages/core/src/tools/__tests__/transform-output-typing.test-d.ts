import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import type { ZodLikeSchema, InferZodLikeSchemaInput } from '../../types/zod-compat';
import { createTool } from '../tool';

/**
 * Type-level tests for GitHub Issue #12426
 * https://github.com/mastra-ai/mastra/issues/12426
 *
 * Verifies that createTool correctly accepts Zod schemas with .transform()
 * on outputSchema, and that execute() can return the pre-transform (input) type.
 *
 * The runtime flow is:
 *   execute() returns pre-transform data → schema.safeParse() → post-transform data
 */
describe('Issue #12426 - outputSchema .transform() type-level tests', () => {
  const transformSchema = z.object({ raw: z.string() }).transform(v => ({ processed: v.raw.toUpperCase() }));

  type PreTransform = z.input<typeof transformSchema>; // { raw: string }
  type PostTransform = z.output<typeof transformSchema>; // { processed: string }

  it('prerequisite: pre-transform and post-transform types are different', () => {
    expectTypeOf<PreTransform>().not.toEqualTypeOf<PostTransform>();
  });

  it('prerequisite: InferZodLikeSchemaInput extracts PreTransform (input type)', () => {
    type InferredInput = InferZodLikeSchemaInput<typeof transformSchema>;
    expectTypeOf<InferredInput>().toEqualTypeOf<PreTransform>();
  });

  it('ZodEffects matches ZodLikeSchema after relaxing _input constraint', () => {
    expectTypeOf<typeof transformSchema>().toMatchTypeOf<ZodLikeSchema<PostTransform>>();
  });

  it('createTool with transformed outputSchema compiles — execute accepts pre-transform return', () => {
    createTool({
      id: 'transform-tool',
      description: 'Tool with transform on outputSchema',
      outputSchema: transformSchema,
      execute: async () => {
        return { raw: 'hello' }; // pre-transform (correct at runtime)
      },
    });
  });

  it('issue reproduction — API response with transform compiles without as any', () => {
    const apiResponseSchema = z
      .object({
        data: z.array(
          z.object({
            user_id: z.string(),
            f_name: z.string(),
            l_name: z.string(),
            acc_status: z.string(),
          }),
        ),
      })
      .transform(response => ({
        activeUsers: response.data
          .filter(u => u.acc_status === 'A')
          .map(user => ({
            userId: user.user_id,
            fullName: `${user.f_name} ${user.l_name}`,
            accountStatus: 'Active' as const,
          })),
      }));

    createTool({
      id: 'list-users',
      description: 'Get active users with LLM-friendly output',
      outputSchema: apiResponseSchema,
      execute: async () => {
        return {
          data: [
            { user_id: '123', f_name: 'John', l_name: 'Doe', acc_status: 'A' },
            { user_id: '456', f_name: 'Jane', l_name: 'Smith', acc_status: 'I' },
          ],
        };
      },
    });
  });

  it('non-transformed outputSchema is backwards compatible', () => {
    const plainSchema = z.object({ name: z.string(), count: z.number() });

    type PlainInput = z.input<typeof plainSchema>;
    type PlainOutput = z.output<typeof plainSchema>;
    expectTypeOf<PlainInput>().toEqualTypeOf<PlainOutput>();

    expectTypeOf<typeof plainSchema>().toMatchTypeOf<ZodLikeSchema<PlainOutput>>();

    createTool({
      id: 'plain-test',
      description: 'Non-transformed schema (always works)',
      outputSchema: plainSchema,
      execute: async () => {
        return { name: 'test', count: 42 };
      },
    });
  });
});
