import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression test for OM sidebar token count drift.
 *
 * The observation header label must use the same live observation window token
 * source as the progress bar, otherwise the sidebar can disagree with the OM
 * buffering marker during active observation cycles.
 */
describe('AgentObservationalMemory token display', () => {
  const sourceFile = resolve(__dirname, '../agent-observational-memory.tsx');
  const source = readFileSync(sourceFile, 'utf-8');

  it('uses the live observation window token count for the observations header label', () => {
    expect(source).toContain(
      'const observationTokenCount =\n    streamProgress?.windows?.active?.observations?.tokens ?? record?.observationTokenCount ?? 0;',
    );

    expect(source).toContain('const tokenCount = observationTokenCount;');
    expect(source).not.toContain('const tokenCount = statusData?.observationalMemory?.observationTokenCount;');
  });
});
