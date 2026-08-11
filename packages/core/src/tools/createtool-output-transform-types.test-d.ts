import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod/v4';

import { createTool } from './tool';

describe('createTool output transform inference (issue #12426)', () => {
  const outputSchema = z.object({ count: z.string().transform(Number) });

  it('accepts output schema input from execute and returns transformed output', async () => {
    const tool = createTool({
      id: 'transform-output',
      description: 'Transforms its output',
      outputSchema,
      execute: async () => ({ count: '42' }),
    });

    const result = await tool.execute?.({}, undefined as never);
    if (result && !('error' in result)) {
      expectTypeOf(result).toEqualTypeOf<{ count: number }>();
    }
  });

  it('rejects schema output from execute when it differs from schema input', () => {
    createTool({
      id: 'invalid-transform-output',
      description: 'Returns transformed output too early',
      outputSchema,
      // @ts-expect-error - execute must return the schema input before the transform runs
      execute: async () => ({ count: 42 }),
    });
  });

  it('keeps non-transform output schemas unchanged', () => {
    createTool({
      id: 'plain-output',
      description: 'Returns a plain output',
      outputSchema: z.object({ count: z.number() }),
      execute: async () => ({ count: 42 }),
    });
  });

  it('allows void returns for suspended tools', () => {
    createTool({
      id: 'suspended-transform-output',
      description: 'Suspends before returning output',
      outputSchema,
      execute: async () => undefined,
    });
  });
});
