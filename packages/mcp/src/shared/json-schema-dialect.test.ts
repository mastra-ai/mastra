import { describe, expect, it } from 'vitest';
import { JSON_SCHEMA_2020_12, toJsonSchema2020 } from './json-schema-dialect';

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
});
