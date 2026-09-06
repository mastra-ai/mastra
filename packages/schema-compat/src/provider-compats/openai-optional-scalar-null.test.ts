import Ajv from 'ajv';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ModelInformation } from '../types';
import { OpenAISchemaCompatLayer } from './openai';

/**
 * OpenAI strict mode turns every optional property into a required-and-nullable one.
 * For scalar enum/const properties the compat layer copied the constraint into the
 * non-null anyOf branch but left it on the outer property node as well. JSON Schema
 * evaluates sibling keywords together, so the outer enum/const still rejected null
 * and the generated schema was not actually nullable.
 * https://github.com/mastra-ai/mastra/issues/23173
 */
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

  it('accepts null for an optional enum property in strict mode', () => {
    const schema = z.object({
      encoding: z.enum(['utf8', 'base64']).optional(),
    });

    const wireSchema = compat.processToJSONSchema(schema) as Record<string, any>;
    const encoding = wireSchema.properties.encoding;

    // null may only be validated by the dedicated null branch
    expect(encoding.anyOf.map((b: any) => b.type)).toEqual(['string', 'null']);
    expect(encoding).not.toHaveProperty('enum');
    expect(encoding).not.toHaveProperty('const');

    // the non-null branch keeps the original constraint
    expect(encoding.anyOf[0].enum).toEqual(['utf8', 'base64']);

    expectWireAccepts(wireSchema, { encoding: null });
    expectWireAccepts(wireSchema, { encoding: 'base64' });
  });

  it('accepts null for an optional const property in strict mode', () => {
    const schema = z.object({
      kind: z.literal('fixed').optional(),
    });

    const wireSchema = compat.processToJSONSchema(schema) as Record<string, any>;
    const kind = wireSchema.properties.kind;

    expect(kind.anyOf.map((b: any) => b.type)).toEqual(['string', 'null']);
    expect(kind).not.toHaveProperty('const');
    expect(kind).not.toHaveProperty('enum');

    expect(kind.anyOf[0].const).toBe('fixed');

    expectWireAccepts(wireSchema, { kind: null });
    expectWireAccepts(wireSchema, { kind: 'fixed' });
  });
});
