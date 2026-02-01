import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';

import { createTool } from '../tool';

/**
 * Runtime tests for GitHub Issue #12426
 * https://github.com/mastra-ai/mastra/issues/12426
 *
 * Verifies that Zod transforms on outputSchema work correctly at runtime:
 * execute() returns pre-transform data, and validation applies the transform
 * via schema.safeParse() before the result reaches the caller.
 */
describe('Issue #12426 - createTool outputSchema with .transform() runtime', () => {
  const formatHeight = (inches: number) => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

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

  type ApiInput = z.input<typeof apiResponseSchema>;
  type ApiOutput = z.output<typeof apiResponseSchema>;

  it('pre-transform and post-transform types are different', () => {
    expectTypeOf<ApiInput>().not.toEqualTypeOf<ApiOutput>();
  });

  it('transform is applied during output validation', async () => {
    const tool = createTool({
      id: 'list-users',
      description: 'Get active users',
      outputSchema: apiResponseSchema,
      execute: async () => {
        // No `as any` needed — execute accepts pre-transform type
        return {
          data: [
            { user_id: '123', f_name: 'John', l_name: 'Doe', acc_status: 'A' },
            { user_id: '456', f_name: 'Jane', l_name: 'Smith', acc_status: 'I' },
          ],
        };
      },
    });

    const result = await tool.execute!({});

    // After validation+transform, output is the post-transform shape
    expect(result).toEqual({
      activeUsers: [
        {
          userId: '123',
          fullName: 'John Doe',
          accountStatus: 'Active',
        },
      ],
    });
  });

  it('simple transform applied correctly', async () => {
    const rawDataSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      heightInches: z.number(),
    });

    const transformedSchema = rawDataSchema.transform(v => ({
      fullName: `${v.firstName} ${v.lastName}`,
      height: formatHeight(v.heightInches),
    }));

    const tool = createTool({
      id: 'get-data',
      description: 'Get formatted data',
      outputSchema: transformedSchema,
      execute: async () => {
        return {
          firstName: 'John',
          lastName: 'Doe',
          heightInches: 74,
        };
      },
    });

    const result = await tool.execute!({});

    expect(result).toEqual({
      fullName: 'John Doe',
      height: '6\'2"',
    });
  });

  it('transform with array output', async () => {
    const rawDataSchema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      heightInches: z.number(),
    });

    const transformedSchema = rawDataSchema
      .transform(v => ({
        fullName: `${v.firstName} ${v.lastName}`,
        height: formatHeight(v.heightInches),
      }))
      .array();

    const tool = createTool({
      id: 'get-data-array',
      description: 'Get formatted data as array',
      outputSchema: transformedSchema,
      execute: async () => {
        return [
          { firstName: 'John', lastName: 'Doe', heightInches: 74 },
          { firstName: 'Jane', lastName: 'Smith', heightInches: 65 },
        ];
      },
    });

    const result = await tool.execute!({});

    expect(result).toEqual([
      { fullName: 'John Doe', height: '6\'2"' },
      { fullName: 'Jane Smith', height: '5\'5"' },
    ]);
  });

  it('non-transformed outputSchema continues working', async () => {
    const plainSchema = z.object({
      name: z.string(),
      count: z.number(),
    });

    const tool = createTool({
      id: 'plain-test',
      description: 'Test plain schema',
      outputSchema: plainSchema,
      execute: async () => {
        return { name: 'test', count: 42 };
      },
    });

    const result = await tool.execute!({});

    if ('error' in result && result.error) {
      throw new Error('Unexpected validation error');
    }

    expect(result.name).toBe('test');
    expect(result.count).toBe(42);
  });
});
