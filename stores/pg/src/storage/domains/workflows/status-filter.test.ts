import { describe, expect, it } from 'vitest';
import { buildWorkflowStatusFilter } from './status-filter';

// Regression for #21619: on a jsonb snapshot column the status predicate must be the
// plain, indexable form. The regexp_replace sanitization is a no-op on jsonb (Postgres
// rejects the bad escapes at insert time) and is the only reason the predicate cannot be
// indexed, forcing a full table scan. It is kept only for json/text columns (the #11563 fix).
describe('buildWorkflowStatusFilter', () => {
  it('uses the plain, indexable predicate for jsonb columns', () => {
    const sql = buildWorkflowStatusFilter(true, 3);
    expect(sql).toBe(`snapshot ->> 'status' = $3`);
    // No wrapping expression -> the planner can use a btree on (snapshot ->> 'status').
    expect(sql).not.toContain('regexp_replace');
    expect(sql).not.toContain('::jsonb');
    expect(sql).not.toContain('::text');
  });

  it('keeps the sanitizing predicate for non-jsonb (json/text) columns', () => {
    const sql = buildWorkflowStatusFilter(false, 2);
    expect(sql).toContain('regexp_replace(snapshot::text');
    // strips NUL and surrogate (D800-DFFF) escapes before the jsonb cast
    expect(sql).toContain(`'\\\\u(0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2})'`);
    expect(sql).toContain(`::jsonb ->> 'status' = $2`);
  });

  it('interpolates the parameter index into both branches', () => {
    expect(buildWorkflowStatusFilter(true, 7)).toContain('$7');
    expect(buildWorkflowStatusFilter(false, 9)).toContain('$9');
  });
});
