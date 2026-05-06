/**
 * Regression tests for #16114 — NestJS adapter coerces query values before
 * route schema validation, breaking parity with Hono/Express/Fastify/Koa.
 *
 * The bug: `MastraController.parseQueryParams` runs a private `coerceQueryValue`
 * over every value, turning string query params into JS booleans / null /
 * numbers / parsed JSON *before* the route's `queryParamSchema` runs. Routes
 * that legitimately want a `z.string()` query field receive the wrong type and
 * fail validation, or worse, succeed with the wrong shape.
 *
 * The other adapters (Hono / Express / Fastify / Koa) keep query values as the
 * raw strings the HTTP layer delivered and let the route schema decide whether
 * to parse / coerce. This test pins NestJS to the same contract.
 */
import { describe, it, expect } from 'vitest';
import { MastraController } from '../controllers/mastra.controller';

function buildController(): MastraController {
  // parseQueryParams only reads from `this` to call its own helpers; the three
  // injected dependencies aren't touched on this code path.
  return new MastraController({} as any, {} as any, {} as any);
}

function parseQueryParams(controller: MastraController, query: Record<string, unknown>): Record<string, unknown> {
  return (controller as any).parseQueryParams(query);
}

describe('NestJS adapter — query params are not pre-schema-coerced (#16114)', () => {
  it('keeps "true" as the string "true" so the route schema decides', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { flag: 'true' })).toEqual({ flag: 'true' });
  });

  it('keeps "false" as the string "false"', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { flag: 'false' })).toEqual({ flag: 'false' });
  });

  it('keeps "null" as the string "null"', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { value: 'null' })).toEqual({ value: 'null' });
  });

  it('keeps a JSON-object string verbatim so a z.string() schema accepts it', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { filter: '{"a":1}' })).toEqual({ filter: '{"a":1}' });
  });

  it('keeps a JSON-array string verbatim', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { items: '[1,2]' })).toEqual({ items: '[1,2]' });
  });

  it('keeps numeric-looking strings as strings (no auto-Number)', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { id: '123', price: '3.14' })).toEqual({ id: '123', price: '3.14' });
  });

  it('still strips dangerous prototype-pollution keys', () => {
    const controller = buildController();
    expect(
      parseQueryParams(controller, {
        ok: 'value',
        __proto__: 'evil',
        prototype: 'evil',
        constructor: 'evil',
      }),
    ).toEqual({ ok: 'value' });
  });

  it('still drops the requestContext key (handled separately)', () => {
    const controller = buildController();
    expect(parseQueryParams(controller, { requestContext: '{"x":1}', other: 'kept' })).toEqual({
      other: 'kept',
    });
  });

  it('preserves array-of-strings shape from frameworks that pass duplicate keys as arrays', () => {
    const controller = buildController();
    // normalizeQueryParams collapses single-element arrays to a string, so
    // a real multi-value comes through as an array of strings.
    expect(parseQueryParams(controller, { tag: ['a', 'b'] })).toEqual({ tag: ['a', 'b'] });
  });
});
