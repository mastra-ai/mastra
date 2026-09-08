import { createScorer } from '@mastra/core/evals';

/**
 * Deterministic scorers used to exercise dataset experiments against the chef
 * agent: one always succeeds, the other alternates, so two experiment runs on
 * the same dataset produce comparable-but-different results.
 */

export const alwaysPassScorer = createScorer({
  id: 'always-pass-scorer',
  name: 'Always Pass',
  description: 'Always returns a perfect score. Useful as a control when comparing experiments.',
})
  .generateScore(() => 1)
  .generateReason(() => 'This scorer always passes.');

let alternatingRunCount = 0;

export const alternatingScorer = createScorer({
  id: 'alternating-scorer',
  name: 'Every Other Run',
  description: 'Passes one run out of two, alternating between 1 and 0 on every invocation.',
})
  .generateScore(() => {
    alternatingRunCount++;
    return alternatingRunCount % 2 === 1 ? 1 : 0;
  })
  .generateReason(({ score }) =>
    score === 1
      ? `Run #${alternatingRunCount} is an odd run, so it passes.`
      : `Run #${alternatingRunCount} is an even run, so it fails.`,
  );
