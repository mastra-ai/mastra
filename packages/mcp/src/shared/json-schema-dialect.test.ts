import { describe, expect, it } from 'vitest';
import { toJsonSchema2020 } from './json-schema-dialect';

describe('toJsonSchema2020', () => {
  it('rewrites nested 2019-09 tuples to prefixItems', () => {
    expect(
      toJsonSchema2020({
        type: 'object',
        properties: {
          closed: { type: 'array', items: [{ type: 'number' }] },
          open: { type: 'array', items: [{ type: 'number' }], additionalItems: { type: 'string' } },
          list: { type: 'array', items: { type: 'string' } },
        },
      }),
    ).toEqual({
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
      type: 'object',
      default: { items: [1, 2] },
      properties: { default: { type: 'array', items: [{ type: 'number' }] }, items: { type: 'string' } },
    };
    expect(toJsonSchema2020(schema)).toEqual({
      type: 'object',
      default: { items: [1, 2] },
      properties: { default: { type: 'array', prefixItems: [{ type: 'number' }] }, items: { type: 'string' } },
    });
  });
});
