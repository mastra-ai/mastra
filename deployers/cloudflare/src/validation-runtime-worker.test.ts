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

  it('rejects asynchronous schemas', () => {
    expect(() => compileDefault({ $async: true, type: 'string' })).toThrow(
      'Asynchronous JSON Schema validation is not supported in Cloudflare Workers',
    );
  });

  it('rejects AJV customization instead of silently ignoring it', () => {
    expect(() => createAjv()).toThrow('AJV customization is not supported in Cloudflare Workers');
  });
});
