import { describe, expect, it } from 'vitest';

import { buildFilterQuery, buildDeleteFilterQuery } from './sql-builder';

describe('buildFilterQuery - top-level vs nested metadata field operators', () => {
  it('emits metadata->> for single top-level fields to match B-tree metadataIndexes', () => {
    const { sql, values } = buildFilterQuery({ resource_id: 'example-resource' }, 0, 10);
    expect(values).toEqual([0, 10, 'example-resource']);
    expect(sql).toContain(`WHERE metadata->>'resource_id' = $3`);
  });

  it('emits metadata->> in buildDeleteFilterQuery for single top-level fields', () => {
    const { sql, values } = buildDeleteFilterQuery({ thread_id: 'thread-123' });
    expect(values).toEqual(['thread-123']);
    expect(sql).toContain(`WHERE metadata->>'thread_id' = $1`);
  });

  it('emits metadata#>> for nested dot-notation fields', () => {
    const { sql, values } = buildFilterQuery({ 'user.profile.id': 'user-1' }, 0, 10);
    expect(values).toEqual([0, 10, 'user-1']);
    expect(sql).toContain(`WHERE metadata#>>'{user,profile,id}' = $3`);
  });

  it('emits metadata->> for top-level basic comparison operators ($eq, $ne)', () => {
    const { sql: sqlEq } = buildFilterQuery({ status: { $eq: 'active' } }, 0, 10);
    expect(sqlEq).toContain(`metadata->>'status' = $3::text`);

    const { sql: sqlNe } = buildFilterQuery({ status: { $ne: 'inactive' } }, 0, 10);
    expect(sqlNe).toContain(`metadata->>'status' != $3::text`);
  });

  it('preserves $nor negation in search and delete filters', () => {
    const filter = { $nor: [{ status: 'active' }, { priority: 'high' }] };

    const { sql: searchSql } = buildFilterQuery(filter, 0, 10);
    expect(searchSql).toContain(`NOT (metadata->>'status' = $3 OR metadata->>'priority' = $4)`);

    const { sql: deleteSql } = buildDeleteFilterQuery(filter);
    expect(deleteSql).toContain(`NOT (metadata->>'status' = $1 OR metadata->>'priority' = $2)`);
  });
});

describe('buildFilterQuery - numeric range operators', () => {
  // JSONB metadata is schemaless: a single row with a non-numeric value at a
  // filtered path (e.g. { price: 'N/A' }) used to make Postgres cast the whole
  // column to ::numeric and raise 22P02, failing the entire query. The generated
  // SQL must guard the cast with jsonb_typeof so non-numeric rows simply don't match.
  const operators = [
    { op: '$gt', symbol: '>' },
    { op: '$gte', symbol: '>=' },
    { op: '$lt', symbol: '<' },
    { op: '$lte', symbol: '<=' },
  ] as const;

  for (const { op, symbol } of operators) {
    it(`${op} guards the numeric cast with jsonb_typeof so mixed-type metadata doesn't fail the query`, () => {
      const { sql, values } = buildFilterQuery({ price: { [op]: 50 } }, 0, 10);

      // The value is appended after [minScore, topK].
      expect(values).toEqual([0, 10, 50]);
      expect(sql).toContain(`jsonb_typeof(metadata->'price') = 'number'`);
      expect(sql).toContain(`(metadata->>'price')::numeric ${symbol} $3::numeric`);
      expect(sql).toContain('ELSE NULL');
      // The bare, unguarded cast must no longer appear on its own.
      expect(sql).not.toMatch(/(?<!THEN )\(metadata->>'price'\)::numeric/);
    });
  }

  it('combines guarded conditions with AND for a range on the same field', () => {
    const { sql, values } = buildFilterQuery({ price: { $gte: 20, $lte: 80 } }, 0, 10);

    expect(values).toEqual([0, 10, 20, 80]);
    expect(sql).toContain(`jsonb_typeof(metadata->'price') = 'number'`);
    expect(sql).toContain(`(metadata->>'price')::numeric >= $3::numeric`);
    expect(sql).toContain(`(metadata->>'price')::numeric <= $4::numeric`);
  });

  it('keeps text comparison (no cast, no guard) when the filter value is non-numeric', () => {
    // e.g. ISO date strings sort correctly as text and never hit the numeric cast.
    const { sql } = buildFilterQuery({ createdAt: { $gt: '2024-01-01' } }, 0, 10);

    expect(sql).toContain(`metadata->>'createdAt' > $3::text`);
    expect(sql).not.toContain('::numeric');
    expect(sql).not.toContain('jsonb_typeof');
  });

  it('rewrites the guard to the element alias inside $elemMatch', () => {
    const { sql } = buildFilterQuery({ items: { $elemMatch: { price: { $gt: 10 } } } }, 0, 10);

    // Both the jsonb_typeof guard and the cast must reference `elem`, not `metadata`.
    expect(sql).toContain(`jsonb_typeof(elem->'price') = 'number'`);
    expect(sql).toContain(`(elem->>'price')::numeric > `);
    expect(sql).not.toContain(`metadata->'price'`);
  });
});
