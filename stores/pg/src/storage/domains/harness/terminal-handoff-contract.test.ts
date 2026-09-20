import { describe, expect, it } from 'vitest';

import { HarnessPG } from './index';

describe('HarnessPG native terminal handoff schema', () => {
  it('exports the canonical evidence, admission, intent, pressure, and tombstone tables', () => {
    const ddl = HarnessPG.getExportDDL().join('\n');
    expect(ddl).toContain('mastra_harness_message_results');
    expect(ddl).toContain('mastra_harness_terminal_admissions');
    expect(ddl).toContain('mastra_harness_terminal_intents');
    expect(ddl).toContain('mastra_harness_terminal_pressure');
    expect(ddl).toContain('mastra_harness_terminal_tombstones');
    expect(ddl).toContain('admission_hash');
    expect(ddl).toContain('payload_bytes');
    expect(ddl).toContain('session_incarnation');
  });
});
