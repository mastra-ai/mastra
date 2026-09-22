import { describe, expect, it } from 'vitest';

import { loadSecurityEvalDataset } from '../../src/mastra/evals/dataset-loader.js';
import { replaySecurityEvalOffline } from '../../src/mastra/evals/offline-replay.js';

describe('Security evaluation offline replay', () => {
  it('derives observed decisions exclusively from inputs', async () => {
    const dataset = await loadSecurityEvalDataset();
    const baseline = replaySecurityEvalOffline(dataset.inputs);
    const alteredExpected = dataset.expected.map(entry => ({
      ...entry,
      disposition: 'manual-review' as const,
      severity: undefined,
    }));
    // Expected is deliberately not an argument to replay; changing a separate
    // ground-truth object cannot influence any observed decision.
    expect(alteredExpected).not.toEqual(dataset.expected);
    expect(replaySecurityEvalOffline(dataset.inputs)).toEqual(baseline);
    expect(baseline.filter(entry => entry.decision.disposition === 'classified')).toHaveLength(54);
  });
});
