import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getObservationWindowTokens } from '../lib/observation-window';
import { observationalMemoryWithRecord } from './fixtures/memory';
import type { OmProgressData } from '@/domains/agents/context';

/**
 * Regression test for OM sidebar token count drift.
 *
 * The observation header label must use the same live observation window token
 * source as the progress bar, otherwise the sidebar can disagree with the OM
 * buffering marker during active observation cycles.
 */
describe('AgentObservationalMemory token display', () => {
  const record = observationalMemoryWithRecord.record && {
    ...observationalMemoryWithRecord.record,
    pendingMessageTokens: 100,
    observationTokenCount: 200,
    config: { observation: { messageTokens: 1000 }, reflection: { observationTokens: 2000 } },
  };

  it('prefers the live observation window over the stored record during an active cycle', () => {
    const liveProgress: OmProgressData = {
      windows: {
        active: {
          messages: { tokens: 1500, threshold: 5000 },
          observations: { tokens: 2500, threshold: 6000 },
        },
        buffered: {
          observations: {
            chunks: 0,
            messageTokens: 0,
            projectedMessageRemoval: 0,
            observationTokens: 0,
            status: 'idle',
          },
          reflection: { inputObservationTokens: 0, observationTokens: 0, status: 'idle' },
        },
      },
      recordId: 'record-1',
      threadId: 'thread-1',
      stepNumber: 1,
      generationCount: 0,
    };

    expect(getObservationWindowTokens({ record, liveProgress, agentConfig: undefined })).toEqual({
      messageTokens: 1500,
      messageThreshold: 5000,
      observationTokens: 2500,
      observationThreshold: 6000,
    });
  });

  it('falls back to the stored record counts when no live progress is streaming', () => {
    expect(getObservationWindowTokens({ record, liveProgress: null, agentConfig: undefined })).toEqual({
      messageTokens: 100,
      messageThreshold: 1000,
      observationTokens: 200,
      observationThreshold: 2000,
    });
  });
});

describe('AgentObservationalMemory tooltip', () => {
  // TODO: replace with a render test. Kept as the only guard on the model-routing rows in the OM tooltip.
  const hostSource = readFileSync(resolve(__dirname, '../agent-observational-memory.tsx'), 'utf-8');
  const displaySource = readFileSync(
    resolve(
      __dirname,
      '../../../../../../../playground-ui/src/domains/memory/components/observational-memory-display.tsx',
    ),
    'utf-8',
  );

  it('shows ModelByInputTokens routing in the OM tooltip when available', () => {
    expect(hostSource).toContain('const observationModelRouting =');
    expect(hostSource).toContain('const reflectionModelRouting =');
    expect(hostSource).toContain('observationModelRouting={observationModelRouting}');
    expect(hostSource).toContain('reflectionModelRouting={reflectionModelRouting}');
    expect(displaySource).toContain('modelRouting?: Array<{ upTo: number; model: string }>;');
    expect(displaySource).toContain('≤{formatTokens(route.upTo)} → {route.model}');
    expect(displaySource).toContain('modelRouting={observationModelRouting}');
    expect(displaySource).toContain('modelRouting={reflectionModelRouting}');
  });
});
