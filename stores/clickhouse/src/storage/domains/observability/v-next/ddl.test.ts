import { describe, expect, it } from 'vitest';

import {
  ALL_MIGRATIONS,
  SPAN_EVENTS_DDL,
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_BRANCHES,
  TABLE_TRACE_ROOTS,
  TRACE_BRANCHES_DDL,
  TRACE_ROOTS_DDL,
} from './ddl';

const USAGE_COLUMNS: Array<[column: string, type: string]> = [
  ['inputTokens', 'Nullable(UInt64)'],
  ['outputTokens', 'Nullable(UInt64)'],
  ['totalTokens', 'Nullable(UInt64)'],
  ['reasoningTokens', 'Nullable(UInt64)'],
  ['cachedTokens', 'Nullable(UInt64)'],
  ['estimatedCost', 'Nullable(Float64)'],
  ['costUnit', 'LowCardinality(Nullable(String))'],
];

// The trace_roots / trace_branches MVs are `SELECT *` from span_events, so all
// three tables must carry an identical usage column set.
const SPAN_TABLES: Array<[table: string, ddl: string]> = [
  [TABLE_SPAN_EVENTS, SPAN_EVENTS_DDL],
  [TABLE_TRACE_ROOTS, TRACE_ROOTS_DDL],
  [TABLE_TRACE_BRANCHES, TRACE_BRANCHES_DDL],
];

describe('span usage columns DDL (OBS-381)', () => {
  it('declares every usage column on span_events and both MV targets', () => {
    for (const [table, ddl] of SPAN_TABLES) {
      for (const [column, type] of USAGE_COLUMNS) {
        const definition = new RegExp(`^\\s*${column}\\s+${type.replace(/[()]/g, '\\$&')},?\\s*$`, 'm');
        expect(ddl, `${table} should declare ${column} ${type}`).toMatch(definition);
      }
    }
  });

  it('has one additive migration per (table, usage column) pair with no DEFAULT', () => {
    for (const [table] of SPAN_TABLES) {
      for (const [column, type] of USAGE_COLUMNS) {
        const matching = ALL_MIGRATIONS.filter(
          entry => entry.kind === 'column' && entry.table === table && entry.name === column,
        );
        expect(matching, `${table}.${column} should have exactly one migration`).toHaveLength(1);
        const { sql } = matching[0]!;
        expect(sql).toBe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
        expect(sql).not.toMatch(/DEFAULT/i);
        expect(type).toContain('Nullable(');
      }
    }
  });

  it('orders the MV target migrations before the span_events migrations', () => {
    const usageNames = new Set(USAGE_COLUMNS.map(([column]) => column));
    const indexOf = (table: string) =>
      ALL_MIGRATIONS.map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.kind === 'column' && entry.table === table && usageNames.has(entry.name))
        .map(({ index }) => index);

    const roots = indexOf(TABLE_TRACE_ROOTS);
    const branches = indexOf(TABLE_TRACE_BRANCHES);
    const spans = indexOf(TABLE_SPAN_EVENTS);
    expect(roots).toHaveLength(USAGE_COLUMNS.length);
    expect(branches).toHaveLength(USAGE_COLUMNS.length);
    expect(spans).toHaveLength(USAGE_COLUMNS.length);

    const lastTarget = Math.max(...roots, ...branches);
    const firstSource = Math.min(...spans);
    expect(lastTarget).toBeLessThan(firstSource);
  });
});
