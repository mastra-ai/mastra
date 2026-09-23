import { describe, expect, it } from 'vitest';
import { additiveColumns, allTableDDL, TABLE_SPAN_EVENTS } from './ddl';

const USAGE_COLUMNS: Array<[column: string, type: string]> = [
  ['inputTokens', 'bigint'],
  ['outputTokens', 'bigint'],
  ['totalTokens', 'bigint'],
  ['reasoningTokens', 'bigint'],
  ['cachedTokens', 'bigint'],
  ['estimatedCost', 'double precision'],
  ['costUnit', 'text'],
];

describe('span usage columns DDL (OBS-381)', () => {
  it('declares every usage column on the span_events CREATE TABLE as nullable with no default', () => {
    const spanTableDDL = allTableDDL('s', 'partitioned')[0]!;
    expect(spanTableDDL).toContain(`"${TABLE_SPAN_EVENTS}"`);

    for (const [column, type] of USAGE_COLUMNS) {
      const definition = new RegExp(`"${column}" ${type}([^\\n,]*)`);
      const match = spanTableDDL.match(definition);
      expect(match, `${column} should be declared`).not.toBeNull();
      expect(match![1]).not.toMatch(/NOT NULL|DEFAULT/i);
    }
  });

  it('adds one nullable additive migration per usage column on span_events', () => {
    const entries = additiveColumns('s');

    for (const [column, type] of USAGE_COLUMNS) {
      const matching = entries.filter(entry => entry.table === TABLE_SPAN_EVENTS && entry.column === column);
      expect(matching, `${column} should have exactly one migration`).toHaveLength(1);

      const { ddl } = matching[0]!;
      expect(ddl).toContain(`ADD COLUMN IF NOT EXISTS "${column}" ${type}`);
      expect(ddl).toContain(`"s"."${TABLE_SPAN_EVENTS}"`);
      expect(ddl).not.toMatch(/NOT NULL|DEFAULT/i);
    }
  });
});
