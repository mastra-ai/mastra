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

// The shorthand `{ field: value }` must build the exact same predicate as the
// explicit `{ field: { $eq: value } }` form, so a bare primitive can no longer
// bypass the type- and null-aware equality rules.
describe('buildFilterQuery primitive shorthand delegates to $eq', () => {
  const cases: Array<[string, unknown]> = [
    ['false', false],
    ['true', true],
    ['0', 0],
    ['string', 'a'],
    ['null', null],
  ];

  for (const [label, value] of cases) {
    it(`builds the same $eq predicate as the explicit form for ${label}`, () => {
      const shorthand = buildFilterQuery({ field: value });
      const explicit = buildFilterQuery({ field: { $eq: value } });

      // The explicit operator-object form is wrapped in one extra pair of
      // parentheses by handleOperator; the underlying predicate must be identical.
      const explicitWhere = explicit.sql.replace(/^WHERE /, '');
      const shorthandWhere = shorthand.sql.replace(/^WHERE /, '');
      expect(explicitWhere).toBe(`(${shorthandWhere})`);
      expect(shorthand.values).toEqual(explicit.values);
    });
  }

  it('distinguishes absent from explicit null for $eq', () => {
    const { sql, values } = buildFilterQuery({ price: null });

    // Present path whose stored JSON type is 'null' — not a raw `= NULL`, which
    // would match nothing, and not `IS NULL`, which would also match absent keys.
    expect(sql).toBe(`WHERE json_type(metadata, '$.price') = 'null'`);
    expect(sql).not.toContain('json_extract');
    expect(values).toEqual([]);
  });

  it('keeps $ne: null as present and non-null', () => {
    const { sql, values } = buildFilterQuery({ price: { $ne: null } });

    expect(sql).toBe(`WHERE (json_type(metadata, '$.price') IS NOT NULL AND json_type(metadata, '$.price') != 'null')`);
    expect(values).toEqual([]);
  });
});

describe('buildFilterQuery type guards', () => {
  it('guards boolean equality with the boolean JSON type', () => {
    expect(buildFilterQuery({ available: false }).sql).toBe(
      `WHERE (json_type(metadata, '$.available') = 'false' AND json_extract(metadata, '$.available') = ?)`,
    );
    expect(buildFilterQuery({ available: true }).sql).toBe(
      `WHERE (json_type(metadata, '$.available') = 'true' AND json_extract(metadata, '$.available') = ?)`,
    );
    expect(buildFilterQuery({ available: false }).values).toEqual([false]);
  });

  it('accepts either integer or real for numeric equality', () => {
    const { sql, values } = buildFilterQuery({ count: 0 });

    expect(sql).toBe(
      `WHERE (json_type(metadata, '$.count') IN ('integer', 'real') AND json_extract(metadata, '$.count') = ?)`,
    );
    expect(values).toEqual([0]);
  });

  it('guards string equality with the text JSON type', () => {
    const { sql, values } = buildFilterQuery({ name: 'a' });

    expect(sql).toBe(`WHERE (json_type(metadata, '$.name') = 'text' AND json_extract(metadata, '$.name') = ?)`);
    expect(values).toEqual(['a']);
  });

  it('keeps $ne present/non-null and scoped to the matching JSON type', () => {
    const { sql, values } = buildFilterQuery({ available: { $ne: false } });

    expect(sql).toBe(
      `WHERE ((json_type(metadata, '$.available') IS NOT NULL AND json_type(metadata, '$.available') != 'null' AND NOT (json_type(metadata, '$.available') = 'false' AND json_extract(metadata, '$.available') = ?)))`,
    );
    expect(values).toEqual([false]);
  });

  it('falls back to a plain comparison for values with no JSON type', () => {
    // Dates have no json_type() guard to build, so $eq keeps the plain compare.
    const date = new Date('2020-01-01T00:00:00.000Z');
    const { sql } = buildFilterQuery({ created: { $eq: date } });

    expect(sql).toBe(`WHERE (json_extract(metadata, '$.created') = ?)`);
    expect(sql).not.toContain('json_type');
  });
});

describe('buildFilterQuery numeric range guards', () => {
  const operators: Array<[string, string, unknown]> = [
    ['$gt', '>', 1],
    ['$gte', '>=', 1],
    ['$lt', '<', 5],
    ['$lte', '<=', 5],
  ];

  for (const [op, symbol, value] of operators) {
    it(`guards ${op} with the numeric JSON type`, () => {
      const { sql, values } = buildFilterQuery({ score: { [op]: value } });

      expect(sql).toBe(
        `WHERE ((json_type(metadata, '$.score') IN ('integer', 'real') AND CAST(json_extract(metadata, '$.score') AS NUMERIC) ${symbol} ?))`,
      );
      expect(values).toEqual([value]);
    });
  }

  it('accepts a numeric-string operand against stored numeric values', () => {
    const { sql, values } = buildFilterQuery({ score: { $gt: '2' } });

    expect(sql).toContain(`json_type(metadata, '$.score') IN ('integer', 'real')`);
    expect(values).toEqual(['2']);
  });

  it('keeps non-numeric string operands on the text branch', () => {
    const { sql } = buildFilterQuery({ created: { $gt: '2020-01-01' } });

    expect(sql).toBe(`WHERE (CAST(json_extract(metadata, '$.created') AS TEXT) > ?)`);
    expect(sql).not.toContain('json_type');
  });

  it('keeps placeholders and bound values aligned across operators', () => {
    const { sql, values } = buildFilterQuery({
      category: 'tools',
      score: { $gte: 3 },
      available: true,
    });

    expect((sql.match(/\?/g) ?? []).length).toBe(values.length);
    expect(values).toEqual(['tools', 3, true]);
  });
});

describe('buildFilterQuery $elemMatch rewrite', () => {
  // Everything from the json_each element source onward is the per-element
  // predicate; it must not reach back to the outer metadata column.
  const elementPredicate = (sql: string) => sql.slice(sql.indexOf('as elem'));

  it('repoints scalar element operators at the element source', () => {
    const { sql, values } = buildFilterQuery({ tags: { $elemMatch: { $gt: 5 } } });

    expect(elementPredicate(sql)).not.toContain('metadata');
    expect(sql).toContain(`elem.type IN ('integer', 'real')`);
    expect(sql).toContain('CAST(elem.value AS NUMERIC) > ?');
    expect(values).toEqual([5]);
  });

  it('repoints nested element fields at the element source', () => {
    const { sql, values } = buildFilterQuery({ reviews: { $elemMatch: { rating: { $gt: 4 } } } });

    expect(elementPredicate(sql)).not.toContain('metadata');
    expect(sql).toContain(`json_type(elem.value, '$.rating') IN ('integer', 'real')`);
    expect(sql).toContain(`CAST(json_extract(elem.value, '$.rating') AS NUMERIC) > ?`);
    expect(values).toEqual([4]);
  });

  it('uses the element JSON type for scalar equality', () => {
    const { sql, values } = buildFilterQuery({ tags: { $elemMatch: { $eq: 'x' } } });

    expect(sql).toContain(`elem.type = 'text' AND elem.value = ?`);
    expect(values).toEqual(['x']);
  });
});

describe('buildFilterQuery multi-key branches inside logical operators', () => {
  // Each object in an $or/$nor array is one branch, and the keys of a branch
  // are an implicit AND (same as at the top level of a filter).
  it('ANDs the keys of one $or branch', () => {
    const { sql, values } = buildFilterQuery({ $or: [{ category: 'electronics', available: true }, { price: 5 }] });

    expect(sql).toBe(
      `WHERE (((json_type(metadata, '$.category') = 'text' AND json_extract(metadata, '$.category') = ?) AND (json_type(metadata, '$.available') = 'true' AND json_extract(metadata, '$.available') = ?)) OR (json_type(metadata, '$.price') IN ('integer', 'real') AND json_extract(metadata, '$.price') = ?))`,
    );
    expect(values).toEqual(['electronics', true, 5]);
  });

  it('negates the whole branch for $nor', () => {
    const { sql, values } = buildFilterQuery({ $nor: [{ status: 'archived', pinned: false }] });

    expect(sql).toBe(
      `WHERE NOT (((json_type(metadata, '$.status') = 'text' AND json_extract(metadata, '$.status') = ?) AND (json_type(metadata, '$.pinned') = 'false' AND json_extract(metadata, '$.pinned') = ?)))`,
    );
    expect(values).toEqual(['archived', false]);
  });

  it('ANDs field keys with a nested logical operator in the same branch', () => {
    const { sql, values } = buildFilterQuery({ $or: [{ $and: [{ a: 1 }], c: 2 }, { d: 3 }] });

    expect(sql).toBe(
      `WHERE ((((json_type(metadata, '$.a') IN ('integer', 'real') AND json_extract(metadata, '$.a') = ?)) AND (json_type(metadata, '$.c') IN ('integer', 'real') AND json_extract(metadata, '$.c') = ?)) OR (json_type(metadata, '$.d') IN ('integer', 'real') AND json_extract(metadata, '$.d') = ?))`,
    );
    expect(values).toEqual([1, 2, 3]);
  });
});
