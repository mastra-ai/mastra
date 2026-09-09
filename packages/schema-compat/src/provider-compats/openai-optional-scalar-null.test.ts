import Ajv from 'ajv';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { OpenAISchemaCompatLayer } from './openai';

describe('OpenAISchemaCompatLayer - optional scalar enum/const nullability', () => {
  const modelInfo: ModelInformation = {
    provider: 'openai',
    modelId: 'gpt-4o',
    supportsStructuredOutputs: false,
  };

  const compat = new OpenAISchemaCompatLayer(modelInfo);

  const expectWireAccepts = (schema: unknown, value: unknown) => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const validate = ajv.compile(schema as object);
    expect(validate(value)).toBe(true);
  };

  const expectWireRejects = (schema: unknown, value: unknown) => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    const validate = ajv.compile(schema as object);
    expect(validate(value)).toBe(false);
  };

  it('accepts null for an optional enum property in strict mode', () => {
    const schema = z.object({
      encoding: z.enum(['utf8', 'base64']).optional(),
    });

    const wireSchema = compat.processToJSONSchema(schema) as Record<string, any>;
    const encoding = wireSchema.properties.encoding;

    expect(encoding.anyOf.map((branch: any) => branch.type)).toEqual(['string', 'null']);
    expect(encoding).not.toHaveProperty('enum');
    expect(encoding.anyOf[0].enum).toEqual(['utf8', 'base64']);

    expectWireAccepts(wireSchema, { encoding: null });
    expectWireAccepts(wireSchema, { encoding: 'base64' });
    expectWireRejects(wireSchema, { encoding: 'hex' });
  });

  it('accepts null for an optional const property in strict mode', () => {
    const schema = z.object({
      kind: z.literal('fixed').optional(),
    });

    const wireSchema = compat.processToJSONSchema(schema) as Record<string, any>;
    const kind = wireSchema.properties.kind;

    expect(kind.anyOf.map((branch: any) => branch.type)).toEqual(['string', 'null']);
    expect(kind).not.toHaveProperty('const');
    expect(kind.anyOf[0].const).toBe('fixed');

    expectWireAccepts(wireSchema, { kind: null });
    expectWireAccepts(wireSchema, { kind: 'fixed' });
    expectWireRejects(wireSchema, { kind: 'other' });
  });
});
