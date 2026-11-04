import { describe, expect, it } from 'vitest';
import { compileDefault, createAjv } from './validation-runtime-worker.js';

describe('Workers-compatible JSON Schema validation runtime', () => {
  it('validates draft-07 schemas and exposes AJV-shaped errors', () => {
    const validate = compileDefault({
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
      additionalProperties: false,
    });

    expect(validate({ city: 'Utrecht' })).toBe(true);
    expect(validate.errors).toBeNull();
    expect(validate({ city: 42 })).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instancePath: '/city',
          message: expect.any(String),
        }),
      ]),
    );
  });

  it('validates draft 2020-12 schemas', () => {
    const validate = compileDefault({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      prefixItems: [{ type: 'string' }],
    });

    expect(validate(['Utrecht'])).toBe(true);
    expect(validate([42])).toBe(false);
  });

  it('matches default AJV behavior by ignoring formats', () => {
    const validate = compileDefault({ type: 'string', format: 'email' });

    expect(validate('not-an-email')).toBe(true);
  });

  it('preserves property names that are also JSON Schema keywords', () => {
    const validate = compileDefault({
      type: 'object',
      properties: { format: { type: 'string' } },
      required: ['format'],
      additionalProperties: false,
    });

    expect(validate({ format: 'json' })).toBe(true);
    expect(validate({ format: 42 })).toBe(false);
  });

  it.each([
    {
      keyword: 'additionalItems',
      schema: {
        type: 'array',
        items: [{ type: 'string' }],
        additionalItems: { type: 'string', format: 'email' },
      },
      value: ['first', 'not-an-email'],
      valid: true,
    },
    {
      keyword: 'additionalProperties',
      schema: {
        type: 'object',
        properties: { known: { type: 'string' } },
        additionalProperties: { type: 'string', format: 'email' },
      },
      value: { known: 'value', extra: 'not-an-email' },
      valid: true,
    },
    {
      keyword: 'patternProperties',
      schema: {
        type: 'object',
        patternProperties: { '^x-': { type: 'string', format: 'email' } },
      },
      value: { 'x-value': 'not-an-email' },
      valid: true,
    },
    {
      keyword: 'dependencies',
      schema: {
        type: 'object',
        dependencies: {
          trigger: {
            properties: { value: { type: 'string', format: 'email' } },
          },
        },
      },
      value: { trigger: true, value: 'not-an-email' },
      valid: true,
    },
    {
      keyword: 'if/then',
      schema: {
        type: 'object',
        if: { properties: { branch: { const: 'then' } } },
        then: { properties: { value: { type: 'string', format: 'email' } } },
      },
      value: { branch: 'then', value: 'not-an-email' },
      valid: true,
    },
    {
      keyword: 'if/else',
      schema: {
        type: 'object',
        if: { properties: { branch: { const: 'then' } } },
        else: { properties: { value: { type: 'string', format: 'email' } } },
      },
      value: { branch: 'else', value: 'not-an-email' },
      valid: true,
    },
    {
      keyword: 'not',
      schema: { not: { type: 'string', format: 'email' } },
      value: 'not-an-email',
      valid: false,
    },
    {
      keyword: 'contains',
      schema: {
        type: 'array',
        contains: { type: 'string', format: 'email' },
      },
      value: ['not-an-email'],
      valid: true,
    },
    {
      keyword: 'definitions',
      schema: {
        $ref: '#/definitions/email',
        definitions: { email: { type: 'string', format: 'email' } },
      },
      value: 'not-an-email',
      valid: true,
    },
  ])('matches default AJV format behavior under $keyword', ({ schema, value, valid }) => {
    expect(compileDefault(schema)(value)).toBe(valid);
  });

  it('rejects asynchronous schemas', () => {
    expect(() => compileDefault({ $async: true, type: 'string' })).toThrow(
      'Asynchronous JSON Schema validation is not supported in Cloudflare Workers',
    );
  });

  it('rejects AJV customization instead of silently ignoring it', () => {
    expect(() => createAjv()).toThrow('AJV customization is not supported in Cloudflare Workers');
  });
});
