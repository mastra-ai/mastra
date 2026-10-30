import { describe, expect, it } from 'vitest';
import { filterNodeSchema } from './filter-node';

describe('filterNodeSchema', () => {
  it('accepts an operator it has never seen, so pages can add operators without a schema change', () => {
    const token = { fieldId: 'status', value: 'error', operatorId: 'startsWith' };
    expect(filterNodeSchema.parse(token)).toEqual(token);
  });

  it('accepts a flat token without an id', () => {
    expect(filterNodeSchema.safeParse({ fieldId: 'status', value: 'error' }).success).toBe(true);
  });

  it.each([
    ['without an id', {}],
    ['with an empty id', { id: '' }],
  ])('rejects a token in a group %s, which the URL could not restore', (_, id) => {
    const group = { id: 'g', logic: 'and', nodes: [{ fieldId: 'status', value: 'error', ...id }] };
    expect(filterNodeSchema.safeParse(group).success).toBe(false);
  });

  it('drops unknown keys on tokens and groups instead of failing', () => {
    const node = {
      id: 'g',
      logic: 'and',
      color: 'red',
      nodes: [{ id: 't', fieldId: 'status', value: 'error', label: 'Status' }],
    };
    expect(filterNodeSchema.parse(node)).toEqual({
      id: 'g',
      logic: 'and',
      nodes: [{ id: 't', fieldId: 'status', value: 'error' }],
    });
  });
});
