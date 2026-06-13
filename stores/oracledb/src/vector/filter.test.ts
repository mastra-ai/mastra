import { describe, expect, it } from 'vitest';

import { buildMetadataWhereClause } from './filter';

// Filter tests assert SQL shape and bind behavior without depending on a live Oracle connection.
describe('buildMetadataWhereClause', () => {
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

  it('uses JSON_EXISTS for existence checks', () => {
    const filter = buildMetadataWhereClause({ source_id: { $exists: true } });

    expect(filter.sql).toContain("JSON_EXISTS(metadata, '$.source_id')");
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
    expect(filter.binds).toEqual({ b0: 'oracle.*database', b1: 'vector\\_search' });
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
});
