import { describe, expect, it } from 'vitest';
import { countJsonValues, JSON_SCHEMA_2020_12, toJsonSchema2020 } from './json-schema-dialect';

const $schema = 'https://json-schema.org/draft/2019-09/schema#';

describe('toJsonSchema2020', () => {
  it('rewrites nested 2019-09 tuples to prefixItems', () => {
    expect(
      toJsonSchema2020({
        $schema,
        type: 'object',
        properties: {
          closed: { type: 'array', items: [{ type: 'number' }] },
          open: { type: 'array', items: [{ type: 'number' }], additionalItems: { type: 'string' } },
          list: { type: 'array', items: { type: 'string' } },
        },
      }),
    ).toEqual({
      $schema: JSON_SCHEMA_2020_12,
      type: 'object',
      properties: {
        closed: { type: 'array', prefixItems: [{ type: 'number' }] },
        open: { type: 'array', prefixItems: [{ type: 'number' }], items: { type: 'string' } },
        list: { type: 'array', items: { type: 'string' } },
      },
    });
  });

  it('leaves instance data untouched but still rewrites properties named like data keywords', () => {
    const schema = {
      $schema,
      type: 'object',
      default: { items: [1, 2] },
      properties: { default: { type: 'array', items: [{ type: 'number' }] }, items: { type: 'string' } },
    };
    expect(toJsonSchema2020(schema)).toEqual({
      $schema: JSON_SCHEMA_2020_12,
      type: 'object',
      default: { items: [1, 2] },
      properties: { default: { type: 'array', prefixItems: [{ type: 'number' }] }, items: { type: 'string' } },
    });
  });

  it('does not convert other dialects', () => {
    expect(
      toJsonSchema2020({ $schema: 'http://json-schema.org/draft-04/schema#', minimum: 5, exclusiveMinimum: true }),
    ).toBeUndefined();
  });

  it('does not convert schemas it cannot translate faithfully', () => {
    expect(
      toJsonSchema2020({ $schema, $recursiveAnchor: true, properties: { a: { $recursiveRef: '#' } } }),
    ).toBeUndefined();
    expect(
      toJsonSchema2020({
        $schema,
        properties: { p: { items: [{ type: 'number' }] }, q: { $ref: '#/properties/p/items/0' } },
      }),
    ).toBeUndefined();
  });

  it('stops converting schemas that exceed the depth or node limits', () => {
    const $schema = 'https://json-schema.org/draft/2019-09/schema#';
    let deep: Record<string, unknown> = { type: 'string' };
    for (let i = 0; i < 1_000; i++) deep = { type: 'array', items: deep };
    expect(toJsonSchema2020({ $schema, ...deep })).toBeUndefined();

    const properties = Object.fromEntries(Array.from({ length: 20_000 }, (_, i) => [`p${i}`, { type: 'string' }]));
    expect(toJsonSchema2020({ $schema, type: 'object', properties })).toBeUndefined();

    expect(toJsonSchema2020({ $schema, type: 'array', items: [{ type: 'string' }] })).toBeDefined();
  });

  it('leaves unknown annotation keywords untouched', () => {
    const $schema = 'https://json-schema.org/draft/2019-09/schema#';
    const ui = { widget: 'list', items: [{ label: 'a' }] };
    const result = toJsonSchema2020({ $schema, type: 'object', 'x-ui': ui });
    expect(result?.['x-ui']).toEqual(ui);
  });

  it('does not convert embedded dialects or contains with unevaluatedItems', () => {
    const $schema = 'https://json-schema.org/draft/2019-09/schema#';
    expect(
      toJsonSchema2020({
        $schema,
        type: 'object',
        properties: { a: { $schema: 'http://json-schema.org/draft-07/schema#', items: [{ type: 'string' }] } },
      }),
    ).toBeUndefined();
    expect(
      toJsonSchema2020({
        $schema,
        type: 'array',
        items: [{ type: 'string' }],
        contains: { type: 'number' },
        unevaluatedItems: false,
      }),
    ).toBeUndefined();
  });

  it('does not convert keywords whose meaning changes or that are not walked', () => {
    const $schema = 'https://json-schema.org/draft/2019-09/schema#';
    // contains reached via an in-place applicator
    expect(
      toJsonSchema2020({
        $schema,
        type: 'array',
        allOf: [{ contains: { type: 'number' } }],
        unevaluatedItems: false,
      }),
    ).toBeUndefined();
    // prefixItems is an annotation in 2019-09 but an assertion in 2020-12
    expect(toJsonSchema2020({ $schema, type: 'array', prefixItems: [{ type: 'string' }] })).toBeUndefined();
    // contentSchema may hide tuple-form items
    expect(
      toJsonSchema2020({ $schema, type: 'string', contentSchema: { type: 'array', items: [{ type: 'string' }] } }),
    ).toBeUndefined();
  });
});

describe('countJsonValues', () => {
  it('rejects a container wider than the budget without expanding it', () => {
    // A container wider than the budget has to be refused, not pushed onto the walk: expanding
    // it first would cost memory proportional to the container the budget exists to bound.
    const values = new Proxy([] as unknown[], {
      get: (target, key, receiver) => {
        if (key === 'length') return 10_000_000;
        if (typeof key === 'string' && /^\d+$/.test(key)) {
          if (Number(key) >= 1_000) throw new Error('expanded an oversized container');
          return undefined;
        }
        return Reflect.get(target, key, receiver);
      },
    });

    expect(countJsonValues({ examples: values }, 100)).toBe(101);
  });

  it('counts scalars, annotations, and nested containers', () => {
    expect(countJsonValues(true, 10)).toBe(1);
    expect(countJsonValues({ type: 'object', examples: [1, 2] }, 10)).toBe(5);
    expect(countJsonValues({ a: { b: true } }, 10)).toBe(3);
  });
});
