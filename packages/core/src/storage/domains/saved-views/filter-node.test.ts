import { describe, expect, it } from 'vitest';
import { filterNodeSchema } from './filter-node';

describe('filterNodeSchema', () => {
  it('accepts an operator it has never seen, so pages can add operators without a schema change', () => {
    const token = { fieldId: 'status', value: 'error', operatorId: 'startsWith' };
    expect(filterNodeSchema.parse(token)).toEqual(token);
  });

  it('drops unknown keys on tokens and groups instead of failing', () => {
    const node = {
      id: 'g',
      logic: 'and',
      color: 'red',
      nodes: [{ fieldId: 'status', value: 'error', label: 'Status' }],
    };
    expect(filterNodeSchema.parse(node)).toEqual({
      id: 'g',
      logic: 'and',
      nodes: [{ fieldId: 'status', value: 'error' }],
    });
  });
});
