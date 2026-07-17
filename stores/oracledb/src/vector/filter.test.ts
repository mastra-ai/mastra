import { describe, expect, it } from 'vitest';

import { buildMetadataWhereClause } from './filter';

// Filter tests assert SQL shape and bind behavior without depending on a live Oracle connection.
describe('buildMetadataWhereClause', () => {
  it('returns an empty clause for missing or empty filters', () => {
    expect(buildMetadataWhereClause()).toEqual({ sql: '', binds: {} });
    expect(buildMetadataWhereClause({})).toEqual({ sql: '', binds: {} });
  });

  it('builds equality filters over Oracle JSON metadata', () => {
    const filter = buildMetadataWhereClause({ resource_id: 'resource-1', thread_id: 'thread-1' });

    expect(filter.sql).toContain("JSON_VALUE(metadata, '$.resource_id' RETURNING VARCHAR2(4000) NULL ON ERROR)");
    expect(filter.sql).toContain("JSON_VALUE(metadata, '$.thread_id' RETURNING VARCHAR2(4000) NULL ON ERROR)");
    expect(filter.binds).toEqual({ b0: 'resource-1', b1: 'thread-1' });
  });

  it('builds logical filters and numeric comparisons', () => {
    const filter = buildMetadataWhereClause({
      $or: [{ priority: { $gte: 3 } }, { kind: { $in: ['memory', 'doc'] } }],
    });

    expect(filter.sql).toContain(' OR ');
    expect(filter.sql).toContain("RETURNING NUMBER NULL ON ERROR) >= :b0");
    expect(filter.sql).toContain('IN (:b1, :b2)');
    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.kind[*]?(@ == $b3)' PASSING :b3 AS \"b3\")");
  });

  it('supports direct array values, single-object logical filters, nested paths, dates, and RegExp values', () => {
    const filter = buildMetadataWhereClause({
      $and: { category: ['database', 'vector'] },
      profile: { tier: { name: 'gold' } },
      createdAt: { $eq: new Date('2026-01-01T00:00:00.000Z') },
      source: /oracle/i,
    });

    expect(filter.sql).toContain('IN (:b0, :b1)');
    expect(filter.sql).toContain("$.profile.tier.name");
    expect(filter.sql).toContain('REGEXP_LIKE');
    expect(filter.sql).toContain(", 'i'");
    expect(Object.values(filter.binds)).toEqual(
      expect.arrayContaining(['database', 'vector', 'gold', '2026-01-01T00:00:00.000Z', 'oracle']),
    );
  });

  it('handles empty logical arrays with deterministic truth values', () => {
    expect(buildMetadataWhereClause({ $or: [] }).sql).toContain('1 = 0');
    expect(buildMetadataWhereClause({ $and: [] }).sql).toContain('1 = 1');
    expect(buildMetadataWhereClause({ $nor: [] }).sql).toContain('1 = 1');
  });

  it('uses JSON_EXISTS for existence checks', () => {
    const filter = buildMetadataWhereClause({ source_id: { $exists: true } });

    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.source_id')");
    expect(filter.binds).toEqual({});
  });

  it('uses NOT JSON_EXISTS for negative existence checks', () => {
    const filter = buildMetadataWhereClause({ source_id: { $exists: false } });

    expect(filter.sql).toContain("NOT JSON_EXISTS(metadata, '$.source_id')");
    expect(filter.binds).toEqual({});
  });

  it('supports not and nor filters', () => {
    const filter = buildMetadataWhereClause({
      $and: [{ project: 'oracle-mastra' }, { source_id: { $not: { $eq: 'draft' } } }],
      $nor: [{ archived: true }, { source_id: 'legacy' }],
    });

    expect(filter.sql).toContain('NOT (');
    expect(filter.sql).toContain(' OR ');
    expect(filter.binds).toMatchObject({ b0: 'oracle-mastra', b1: 'draft', b2: 'true', b3: 'legacy' });
  });

  it('supports array-oriented filters', () => {
    const filter = buildMetadataWhereClause({
      tags: { $all: ['oracle', 'mastra'], $size: 2 },
      chunks: { $elemMatch: { score: { $gte: 0.9 } } },
    });

    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.tags[*]?(@ == $b0)' PASSING :b0 AS \"b0\")");
    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.tags?(@.size() == $b2)' PASSING :b2 AS \"b2\")");
    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.chunks[*]?(@.score >= $b3)' PASSING :b3 AS \"b3\")");
  });

  it('supports regex and contains filters', () => {
    const filter = buildMetadataWhereClause({
      source: { $regex: 'oracle.*database' },
      text: { $contains: 'Vector_Search' },
    });

    expect(filter.sql).toContain('REGEXP_LIKE');
    expect(filter.sql).toContain('LIKE');
    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.text[*]?(@ == $b2)' PASSING :b2 AS \"b2\")");
    expect(filter.binds).toEqual({ b0: 'oracle.*database', b1: 'vector\\_search', b2: 'Vector_Search' });
  });

  it('supports string contains against scalar and array metadata', () => {
    const filter = buildMetadataWhereClause({
      tags: { $contains: 'premium' },
    });

    expect(filter.sql).toContain("LOWER(JSON_VALUE(metadata, '$.tags' RETURNING VARCHAR2(4000) NULL ON ERROR)) LIKE '%' || :b0 || '%'");
    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.tags[*]?(@ == $b1)' PASSING :b1 AS \"b1\")");
    expect(filter.binds).toEqual({ b0: 'premium', b1: 'premium' });
  });

  it('supports contains over arrays and structured values', () => {
    const arrayFilter = buildMetadataWhereClause({ tags: { $contains: ['oracle', 'vector'] } });
    const objectFilter = buildMetadataWhereClause({ profile: { $contains: { tier: 'gold' } } });

    expect(arrayFilter.sql).toContain("JSON_EXISTS(metadata, '$.tags[*]?(@ == $b0)'");
    expect(arrayFilter.sql).toContain("JSON_EXISTS(metadata, '$.tags[*]?(@ == $b1)'");
    expect(objectFilter.sql).toContain("JSON_SERIALIZE(JSON_QUERY(metadata, '$.profile'");
    expect(objectFilter.binds).toEqual({ b0: '{"tier":"gold"}' });
  });

  it('supports negative set filters and nested not filters', () => {
    const filter = buildMetadataWhereClause({
      kind: { $nin: [] },
      profile: { $not: { tier: 'free' } },
      chunks: { $elemMatch: { score: { $nin: [] } } },
    });

    expect(filter.sql).toContain('1 = 1');
    expect(filter.sql).toContain('NOT (');
    expect(filter.sql).toContain('true');
  });

  it('supports null comparisons, empty sets, and elemMatch comparison variants', () => {
    const filter = buildMetadataWhereClause({
      deletedAt: { $eq: null },
      archivedAt: { $ne: null },
      kind: { $in: [] },
      tags: { $all: [] },
      values: { $elemMatch: { $ne: 'draft', $gt: 1, $lt: 10, $in: ['a', 'b'] } },
    });

    expect(filter.sql).toContain('IS NULL');
    expect(filter.sql).toContain('IS NOT NULL');
    expect(filter.sql).toContain('1 = 0');
    expect(filter.sql).toContain('1 = 1');
    expect(filter.sql).toContain('@ != $');
    expect(filter.sql).toContain('@ > $');
    expect(filter.sql).toContain('@ < $');
    expect(filter.sql).toContain(' || ');
  });

  it('supports case-insensitive regex prefixes and elemMatch set edge cases', () => {
    const filter = buildMetadataWhereClause({
      source: { $regex: '(?i)oracle.*database' },
      values: {
        $elemMatch: {
          $in: [],
          category: { $lte: 10, $nin: ['archived', 'draft'] },
        },
      },
    });

    expect(filter.sql).toContain("REGEXP_LIKE(JSON_VALUE(metadata, '$.source' RETURNING VARCHAR2(4000) NULL ON ERROR), :b0, 'i')");
    expect(filter.sql).toContain('false');
    expect(filter.sql).toContain('@.category <= $');
    expect(filter.sql).toContain('@.category != $');
    expect(filter.binds.b0).toBe('oracle.*database');
  });

  it('normalizes boolean binds for VARCHAR2 JSON comparisons', () => {
    const filter = buildMetadataWhereClause({ archived: true });

    expect(filter.sql).toContain("JSON_VALUE(metadata, '$.archived' RETURNING VARCHAR2(4000) NULL ON ERROR)");
    expect(filter.binds).toEqual({ b0: 'true' });
  });

  it('quotes non-identifier metadata paths instead of interpolating raw SQL', () => {
    const filter = buildMetadataWhereClause({ "source-id') or 1=1 --": 'safe' });

    expect(filter.sql).toContain('$."source-id\'\') or 1=1 --"');
    expect(filter.binds).toEqual({ b0: 'safe' });
  });

  it('rejects invalid filter operators and operands', () => {
    expect(() => buildMetadataWhereClause('bad' as any)).toThrow(/must be an object/i);
    expect(() => buildMetadataWhereClause({ $bad: {} } as any)).toThrow(/Unsupported root/i);
    expect(() => buildMetadataWhereClause({ $not: {} })).toThrow(/\$not requires/i);
    expect(() => buildMetadataWhereClause({ source_id: { $not: {} } })).toThrow(/\$not requires/i);
    expect(() => buildMetadataWhereClause({ tags: { $size: -1 } })).toThrow(/\$size requires/i);
    expect(() => buildMetadataWhereClause({ chunks: { $elemMatch: 'bad' } })).toThrow(/\$elemMatch requires/i);
    expect(() => buildMetadataWhereClause({ chunks: { $elemMatch: { $bad: true } } })).toThrow(
      /Unsupported \$elemMatch operator/i,
    );
  });

  it('treats a bare Date value as direct equality instead of an empty nested object', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const filter = buildMetadataWhereClause({ createdAt });

    expect(filter.sql).toContain("JSON_VALUE(metadata, '$.createdAt' RETURNING VARCHAR2(4000) NULL ON ERROR) = :b0");
    expect(filter.binds).toEqual({ b0: '2026-01-01T00:00:00.000Z' });
  });

  it('rejects a genuinely empty nested object instead of emitting an empty predicate', () => {
    expect(() => buildMetadataWhereClause({ profile: {} })).toThrow(/cannot be an empty object/i);
  });

  it('rejects an object that mixes operator keys with plain nested fields', () => {
    expect(() => buildMetadataWhereClause({ profile: { $exists: true, tier: 'gold' } as any })).toThrow(
      /mixed operator\/nested-field/i,
    );
  });
});
