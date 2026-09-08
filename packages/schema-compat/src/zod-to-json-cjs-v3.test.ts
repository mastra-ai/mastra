import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const requireFromPackage = createRequire(import.meta.url);

describe('CommonJS build', () => {
  it('converts Zod v3 schemas through zodToJsonSchema', () => {
    const { zodToJsonSchema } = requireFromPackage('../dist/zod-to-json.cjs') as {
      zodToJsonSchema(schema: unknown): {
        type?: string;
        properties?: Record<string, { type?: string }>;
      };
    };

    const result = zodToJsonSchema(z.object({ url: z.string().url() }));

    expect(result).toMatchObject({
      type: 'object',
      properties: { url: { type: 'string' } },
    });
  });

  it('converts Zod v3 schemas through the standard schema adapter', () => {
    const { toStandardSchema } = requireFromPackage('../dist/standard-schema/adapters/zod-v3.cjs') as {
      toStandardSchema(schema: unknown): {
        '~standard': {
          jsonSchema: {
            output(options: { target: string }): {
              type?: string;
              properties?: Record<string, { type?: string }>;
            };
          };
        };
      };
    };

    const result = toStandardSchema(z.object({ url: z.string().url() }))['~standard'].jsonSchema.output({
      target: 'draft-07',
    });

    expect(result).toMatchObject({
      type: 'object',
      properties: { url: { type: 'string' } },
    });
  });
});
