import { describe, it, expect } from 'vitest';
import { createTrajectoryEfficiencyScorer } from '../trajectory-efficiency';
import type { MastraCodeExperimentOutput } from '../../../experiments/lifecycle';
import type { MastraCodeGroundTruth } from '../../../experiments/types';

function makeOutput(overrides: Partial<MastraCodeExperimentOutput> = {}): MastraCodeExperimentOutput {
  return { messages: [], toolCalls: [], errors: [], startedAt: 0, completedAt: 1000, ...overrides };
}

function tc(toolName: string, args?: Record<string, unknown>) {
  return { toolName, args, result: null };
}

describe('Trajectory Efficiency Scorer', () => {
  const scorer = createTrajectoryEfficiencyScorer();

  it('detects redundant consecutive identical tool calls', async () => {
    const clean = makeOutput({
      toolCalls: [tc('view', { path: 'a.ts' }), tc('view', { path: 'b.ts' }), tc('edit', { path: 'a.ts' })],
    });
    const redundant = makeOutput({
      toolCalls: [
        tc('view', { path: 'a.ts' }),
        tc('view', { path: 'a.ts' }),
        tc('view', { path: 'a.ts' }),
        tc('view', { path: 'a.ts' }),
        tc('edit', { path: 'a.ts' }),
      ],
    });
    const gt: MastraCodeGroundTruth = { maxToolCalls: 20 };

    const cleanResult = await scorer.run({ input: {}, output: clean, groundTruth: gt });
    const redundantResult = await scorer.run({ input: {}, output: redundant, groundTruth: gt });

    expect(redundantResult.score).toBeLessThan(cleanResult.score);
  });

  it('penalizes proportionally when exceeding budget', async () => {
    const atBudget = makeOutput({ toolCalls: Array.from({ length: 5 }, (_, i) => tc('view', { path: `${i}.ts` })) });
    const twiceBudget = makeOutput({ toolCalls: Array.from({ length: 10 }, (_, i) => tc('view', { path: `${i}.ts` })) });
    const tripleBudget = makeOutput({ toolCalls: Array.from({ length: 15 }, (_, i) => tc('view', { path: `${i}.ts` })) });
    const gt: MastraCodeGroundTruth = { maxToolCalls: 5 };

    const atScore = (await scorer.run({ input: {}, output: atBudget, groundTruth: gt })).score;
    const twiceScore = (await scorer.run({ input: {}, output: twiceBudget, groundTruth: gt })).score;
    const tripleScore = (await scorer.run({ input: {}, output: tripleBudget, groundTruth: gt })).score;

    expect(atScore).toBeGreaterThan(twiceScore);
    expect(twiceScore).toBeGreaterThan(tripleScore);
  });
});
