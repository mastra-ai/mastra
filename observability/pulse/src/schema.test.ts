import { PULSES_DDL, RELATIONSHIPS_DDL } from '@mastra/clickhouse';
import { describe, expect, it } from 'vitest';
import { PULSE_TABLES_DDL } from './schema';

/**
 * Anti-drift pin: this package's standalone DDL is a hand-copy of the
 * canonical schema in @mastra/clickhouse (it cannot import it at runtime —
 * the standalone exporter is dependency-free by design). This test makes the
 * duplication IMPOSSIBLE to drift silently: change one, the test names the
 * other. The standalone set intentionally omits the `flows` index table
 * (the HTTP exporter has no flowIndex support).
 */
describe('standalone DDL stays pinned to the canonical @mastra/clickhouse schema', () => {
  const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim();

  it('pulses table matches', () => {
    expect(normalize(PULSE_TABLES_DDL[0]!)).toBe(normalize(PULSES_DDL));
  });

  it('relationships table matches', () => {
    expect(normalize(PULSE_TABLES_DDL[1]!)).toBe(normalize(RELATIONSHIPS_DDL));
  });
});
