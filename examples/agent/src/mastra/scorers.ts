import { createScorer } from '@mastra/core/evals';

// Custom scorer that always succeeds: every scored item gets a score of 1.
export const alwaysPassScorer = createScorer({
  id: 'always-pass',
  name: 'Always Pass',
  description: 'Custom scorer that always returns 1 (success) for every item.',
}).generateScore(() => 1);

let alternatingScoreCount = 0;

// Custom scorer that alternates between success and failure across scored items.
export const alternatingPassScorer = createScorer({
  id: 'alternating-pass',
  name: 'Alternating Pass',
  description: 'Custom scorer that returns 1 for every other item and 0 for the rest.',
}).generateScore(() => {
  alternatingScoreCount += 1;
  return alternatingScoreCount % 2 === 1 ? 1 : 0;
});
