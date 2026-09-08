import { describe, expect, it } from 'vitest';
import { z } from 'zod/v3';
import { AnthropicSchemaCompatLayer } from './provider-compats/anthropic';
import type { ModelInformation } from './types';

const haikuModelInfo: ModelInformation = {
  provider: 'anthropic',
  modelId: 'claude-3.5-haiku-20241022',
  supportsStructuredOutputs: false,
};

describe('Anthropic Haiku Zod v3 validation compatibility', () => {
  it('keeps validation synchronous and preserves refinements and string formats', () => {
    const schema = z
      .object({
        email: z.string().email().min(100),
        id: z.string().uuid().max(1),
      })
      .refine(value => value.email !== 'blocked@example.com', { message: 'email is blocked' });
    const compatSchema = new AnthropicSchemaCompatLayer(haikuModelInfo).processToCompatSchema(schema);

    const validResult = compatSchema['~standard'].validate({
      email: 'hello@example.com',
      id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(validResult).not.toBeInstanceOf(Promise);
    expect(validResult).toEqual({
      value: {
        email: 'hello@example.com',
        id: '123e4567-e89b-12d3-a456-426614174000',
      },
    });

    const invalidFormatResult = compatSchema['~standard'].validate({ email: 'invalid', id: 'invalid' });
    expect(invalidFormatResult).not.toBeInstanceOf(Promise);
    expect(invalidFormatResult).toHaveProperty('issues');

    const invalidRefineResult = compatSchema['~standard'].validate({
      email: 'blocked@example.com',
      id: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(invalidRefineResult).not.toBeInstanceOf(Promise);
    expect(invalidRefineResult).toHaveProperty('issues');
  });

  it('preserves strict and catchall object policies', () => {
    const layer = new AnthropicSchemaCompatLayer(haikuModelInfo);
    const strictSchema = z.object({ message: z.string().min(100) }).strict();
    const catchallSchema = z.object({ message: z.string().min(100) }).catchall(z.number());

    expect(
      layer.processToCompatSchema(strictSchema)['~standard'].validate({ message: 'short', extra: true }),
    ).toHaveProperty('issues');
    expect(layer.processToCompatSchema(catchallSchema)['~standard'].validate({ message: 'short', extra: 1 })).toEqual({
      value: { message: 'short', extra: 1 },
    });
    expect(
      layer.processToCompatSchema(catchallSchema)['~standard'].validate({ message: 'short', extra: 'invalid' }),
    ).toHaveProperty('issues');
  });

  it('preserves nested tuple, record, lazy, and transform behavior', () => {
    let transformCalls = 0;
    const nestedValue = z.lazy(() =>
      z.object({
        entries: z.record(
          z.tuple([
            z.string().email().min(100),
            z
              .string()
              .min(100)
              .transform(value => {
                transformCalls++;
                return value.toUpperCase();
              }),
          ]),
        ),
      }),
    );
    const compatSchema = new AnthropicSchemaCompatLayer(haikuModelInfo).processToCompatSchema(nestedValue);

    const result = compatSchema['~standard'].validate({
      entries: { item: ['hello@example.com', 'short'] },
    });
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toEqual({ value: { entries: { item: ['hello@example.com', 'SHORT'] } } });
    expect(transformCalls).toBe(1);
  });
});
