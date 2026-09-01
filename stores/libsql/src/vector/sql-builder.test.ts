import { describe, expect, it } from 'vitest';

import { buildFilterQuery } from './sql-builder';

describe('buildFilterQuery $size operator', () => {
  it('binds the array size with an anonymous placeholder', () => {
    const { sql, values } = buildFilterQuery({ tags: { $size: 2 } });

    expect(sql).toContain('json_array_length');
    expect(sql).toContain('= ?');
    expect(sql).not.toMatch(/\$\d/);
    expect(values).toEqual([2]);
  });

  it('preserves positional binding order with other conditions', () => {
    const { sql, values } = buildFilterQuery({ tags: { $size: 5 }, category: 'tools' });

    expect((sql.match(/\?/g) ?? []).length).toBe(values.length);
    expect(values).toEqual([5, 'tools']);
  });

  it('binds the array size when nested in $and', () => {
    const { sql, values } = buildFilterQuery({ $and: [{ tags: { $size: 3 } }] });

    expect(sql).toContain('json_array_length');
    expect(sql).not.toMatch(/\$\d/);
    expect(values).toEqual([3]);
  });
});
