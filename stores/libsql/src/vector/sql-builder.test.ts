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

describe('buildFilterQuery multi-key branches inside logical operators', () => {
  // Each object in an $or/$nor array is one branch, and the keys of a branch
  // are an implicit AND (same as at the top level of a filter).
  it('ANDs the keys of one $or branch', () => {
    const { sql, values } = buildFilterQuery({ $or: [{ category: 'electronics', available: true }, { price: 5 }] });

    expect(sql).toBe(
      `WHERE ((json_extract(metadata, '$.category') = ? AND json_extract(metadata, '$.available') = ?) OR json_extract(metadata, '$.price') = ?)`,
    );
    expect(values).toEqual(['electronics', true, 5]);
  });

  it('negates the whole branch for $nor', () => {
    const { sql, values } = buildFilterQuery({ $nor: [{ status: 'archived', pinned: false }] });

    expect(sql).toBe(`WHERE NOT ((json_extract(metadata, '$.status') = ? AND json_extract(metadata, '$.pinned') = ?))`);
    expect(values).toEqual(['archived', false]);
  });

  it('ANDs field keys with a nested logical operator in the same branch', () => {
    const { sql, values } = buildFilterQuery({ $or: [{ $and: [{ a: 1 }], c: 2 }, { d: 3 }] });

    expect(sql).toBe(
      `WHERE (((json_extract(metadata, '$.a') = ?) AND json_extract(metadata, '$.c') = ?) OR json_extract(metadata, '$.d') = ?)`,
    );
    expect(values).toEqual([1, 2, 3]);
  });
});
