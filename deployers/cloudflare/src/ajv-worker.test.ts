import { describe, expect, it } from 'vitest';
import Ajv, { Ajv as NamedAjv } from './ajv-worker.js';

describe('Workers-compatible AJV facade', () => {
  it('supports the AJV root module exports', () => {
    expect(Ajv).toBe(NamedAjv);
  });

  it('validates draft-07 schemas and exposes AJV-shaped errors', () => {
    const validate = new Ajv().compile({
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
    const validate = new Ajv().compile({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      prefixItems: [{ type: 'string' }],
    });

    expect(validate(['Utrecht'])).toBe(true);
    expect(validate([42])).toBe(false);
  });

  it('rejects asynchronous schemas', () => {
    expect(() => new Ajv().compile({ $async: true, type: 'string' })).toThrow(
      'Asynchronous JSON Schema validation is not supported in Cloudflare Workers',
    );
  });
});
