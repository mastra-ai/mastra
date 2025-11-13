import { createScorer } from '@mastra/core/scores';
import { calculateRatio, countChanges } from '../../../ratio';

export function createTextualDifferenceScorer() {
  return createScorer({
    name: 'Textual Difference Scorer',
    description: 'Calculate textual difference between input and output using sequence matching algorithms.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const input = run.input?.inputMessages?.map((i: { content: string }) => i.content).join(', ') || '';
      const output = run.output?.map((i: { content: string }) => i.content).join(', ') || '';

      // Calculate similarity ratio using LCS approach (similar to SequenceMatcher.ratio())
      const ratio = calculateRatio(input, output);

      // Count changes by comparing words
      const changes = countChanges(input, output);

      // Calculate confidence based on text length difference
      const maxLength = Math.max(input.length, output.length);
      const lengthDiff = maxLength > 0 ? Math.abs(input.length - output.length) / maxLength : 0;
      const confidence = 1 - lengthDiff;

      return {
        ratio,
        confidence,
        changes,
        lengthDiff,
      };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.ratio;
    });
}
