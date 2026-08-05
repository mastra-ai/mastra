import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

  it('derives observation token counts from the shared observation-window helper', () => {
    // The header label and the progress bar must read from the same source so the
    // sidebar never disagrees with the OM buffering marker during active cycles.
    // That derivation now lives in the shared getObservationWindowTokens helper.
    expect(source).toContain("import { getObservationWindowTokens } from './lib/observation-window';");
    expect(source).toContain('getObservationWindowTokens({ record, liveProgress, agentConfig: omAgentConfig });');
    expect(source).not.toContain('const tokenCount = statusData?.observationalMemory?.observationTokenCount;');
  });

  it('shows ModelByInputTokens routing in the OM tooltip when available', () => {
    expect(source).toContain('modelRouting?: Array<{ upTo: number; model: string }>;');
    expect(source).toContain('const observationModelRouting =');
    expect(source).toContain('const reflectionModelRouting =');
    expect(source).toContain('≤{formatTokens(route.upTo)} → {route.model}');
    expect(source).toContain('modelRouting={observationModelRouting}');
    expect(source).toContain('modelRouting={reflectionModelRouting}');
  });
});
