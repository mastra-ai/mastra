import { describe, expect, it } from 'vitest';
import { validateInputSchema } from './input-schema-validation';

describe('validateInputSchema', () => {
  it('rejects the malformed server schema with its location', () => {
    expect(
      validateInputSchema({ type: 'object', properties: { coin: { type: 'string' }, required: ['coin'] } }),
    ).toEqual({ success: false, reason: '/properties/required: must be object,boolean' });
  });

  it.each([
    null,
    undefined,
    true,
    false,
    [],
    'object',
    1,
    {},
    { type: 'array' },
    { jsonSchema: null },
    { jsonSchema: [] },
    { jsonSchema: { type: 'string' } },
  ])('rejects invalid root or wrapper %j', schema => {
    expect(validateInputSchema(schema).success).toBe(false);
  });

  it.each([
    { properties: { child: [] } },
    { properties: { child: { type: 'not-a-type' } } },
    { required: 'coin' },
    { required: ['coin', 'coin'] },
    { allOf: [{ properties: { child: null } }] },
    { additionalProperties: [] },
    { properties: { child: { minimum: 'zero' } } },
    { $schema: 123 },
  ])('rejects invalid schema keyword types %j', keywords => {
    expect(validateInputSchema({ type: 'object', ...keywords }).success).toBe(false);
  });

  it.each([
    {},
    { properties: { required: { type: 'string' } }, required: ['required'] },
    { properties: { allowed: true, denied: false }, additionalProperties: false },
    { properties: { tuple: { type: 'array', items: [{ type: 'string' }], additionalItems: false } } },
    { properties: { tuple: { type: 'array', prefixItems: [{ type: 'string' }], items: false } } },
    { $defs: { child: { type: 'string' } }, properties: { child: { $ref: '#/$defs/child' } } },
    { properties: { child: { $ref: 'https://example.invalid/schema.json' } } },
    { properties: { child: { $ref: '#' } } },
    { allOf: [{ type: 'object' }], anyOf: [true, false], not: false },
    { properties: { coin: { type: 'string', format: 'custom-coin' } }, 'x-custom': { enabled: true } },
    { title: 'Input', description: 'Tool arguments', examples: [{}], deprecated: true },
  ])('preserves valid undialected schemas %j', keywords => {
    const schema = { type: 'object', ...keywords };
    const result = validateInputSchema(schema);
    expect(result).toEqual({ success: true, schema });
    if (result.success) expect(result.schema).toBe(schema);
  });

  it.each([
    'http://json-schema.org/draft-07/schema#',
    'https://json-schema.org/draft-07/schema',
    'https://json-schema.org/draft/2019-09/schema',
    'http://json-schema.org/draft/2019-09/schema#',
    'https://json-schema.org/draft/2020-12/schema',
    'http://json-schema.org/draft/2020-12/schema#',
  ])('supports the dialect URI alias %s', $schema => {
    const schema = { $schema, type: 'object', properties: { child: false } };
    expect(validateInputSchema(schema)).toEqual({ success: true, schema });
  });

  it('checks modern keywords using the explicit dialect', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { tuple: { type: 'array', prefixItems: [{ type: 'string' }], items: false } },
    };
    expect(validateInputSchema(schema)).toEqual({ success: true, schema });
    expect(
      validateInputSchema({ ...schema, properties: { tuple: { type: 'array', prefixItems: ['invalid'] } } }).success,
    ).toBe(false);
    expect(
      validateInputSchema({ ...schema, properties: { tuple: { type: 'array', items: [{ type: 'string' }] } } }).success,
    ).toBe(false);
  });

  it('preserves legacy tuple items with an explicit draft-07 dialect', () => {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: { tuple: { type: 'array', items: [{ type: 'string' }] } },
    };
    expect(validateInputSchema(schema)).toEqual({ success: true, schema });
  });

  it('reports unsupported explicit dialects distinctly', () => {
    expect(validateInputSchema({ type: 'object', $schema: 'https://example.invalid/private-dialect' })).toEqual({
      success: false,
      reason: '/$schema: unsupported JSON Schema dialect',
    });
  });

  it('unwraps existing jsonSchema wrappers without modifying or cloning the schema', () => {
    const schema = Object.freeze({
      $schema: 'http://json-schema.org/draft/2020-12/schema#',
      type: 'object',
      properties: Object.freeze({ coin: Object.freeze({ type: 'string' }) }),
    });
    const wrapped = Object.freeze({ jsonSchema: schema });
    const before = JSON.stringify(wrapped);
    const result = validateInputSchema(wrapped);
    expect(result).toEqual({ success: true, schema });
    if (result.success) expect(result.schema).toBe(schema);
    expect(JSON.stringify(wrapped)).toBe(before);
  });

  it('does not register tool IDs or resolve references when validating repeated schemas', () => {
    for (const $schema of [
      undefined,
      'https://json-schema.org/draft/2019-09/schema',
      'https://json-schema.org/draft/2020-12/schema',
    ]) {
      for (const child of [{ type: 'string' }, { type: 'number' }]) {
        const schema = {
          ...($schema ? { $schema } : {}),
          $id: 'https://example.invalid/shared-id',
          type: 'object',
          properties: { child, unresolved: { $ref: 'https://example.invalid/unavailable' }, recursive: { $ref: '#' } },
        };
        expect(validateInputSchema(schema)).toEqual({ success: true, schema });
      }
    }
  });

  it('bounds diagnostics instead of logging a complete schema', () => {
    const result = validateInputSchema({ type: 'object', properties: { ['x'.repeat(1000)]: [] } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason.length).toBeLessThanOrEqual(400);
  });
});
