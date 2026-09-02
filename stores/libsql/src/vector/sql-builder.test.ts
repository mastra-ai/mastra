import { describe, it, expect } from 'vitest';
import { buildFilterQuery } from './sql-builder';

describe('buildFilterQuery $size operator', () => {
  it('binds $size with an anonymous placeholder and the filter value', () => {
    const { sql, values } = buildFilterQuery({ tags: { $size: 2 } });

    // The previous implementation misused the filter value as a parameter
    // index, emitting a named reference ($2) that never matched the
    // positional bindings.
    expect(sql).not.toMatch(/\$\d/);
    expect(sql).toContain('json_array_length');
    expect(sql).toContain('= ?');
    expect(values).toEqual([2]);
  });

  it('does not collide with other parameters for non-trivial $size values', () => {
    const { sql, values } = buildFilterQuery({ tags: { $size: 5 }, category: 'tools' });

    expect(sql).not.toMatch(/\$\d/);
    // $size value first, then the equality value — both positional.
    expect(values).toEqual([5, 'tools']);
    expect((sql.match(/\?/g) ?? []).length).toBe(values.length);
  });

  it('handles $size nested in $and', () => {
    const { sql, values } = buildFilterQuery({ $and: [{ tags: { $size: 3 } }] });

    expect(sql).not.toMatch(/\$\d/);
    expect(sql).toContain('json_array_length');
    expect(values).toEqual([3]);
  });
});
