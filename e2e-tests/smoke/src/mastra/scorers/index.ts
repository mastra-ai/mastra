import { createScorer } from '@mastra/core/evals';

/**
 * A simple scorer that checks if the output is non-empty.
 * Returns 1 if output has content, 0 otherwise. No LLM required.
 */
export const completenessScorer = createScorer({
  id: 'completeness',
  name: 'Completeness Scorer',
  description: 'Checks whether the output contains non-empty content',
}).generateScore(({ run }) => {
  const output = run.output;
  if (output && typeof output === 'object' && 'text' in output && (output as any).text?.length > 0) {
    return 1;
  }
  if (typeof output === 'string' && output.length > 0) {
    return 1;
  }
  return 0;
});

/**
 * A scorer that measures output length relative to a threshold.
 * Returns a score between 0 and 1 based on output length. No LLM required.
 */
export const lengthScorer = createScorer({
  id: 'length-check',
  name: 'Length Check Scorer',
  description: 'Scores output based on character length (0-1 scale)',
}).generateScore(({ run }) => {
  const threshold = 100;
  const text = typeof run.output === 'string' ? run.output : JSON.stringify(run.output);
  return Math.min(text.length / threshold, 1);
});
