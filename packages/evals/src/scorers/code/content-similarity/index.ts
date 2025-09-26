import { createScorer } from '@mastra/core/scores';
import stringSimilarity from 'string-similarity';

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export function createContentSimilarityScorer(
  { ignoreCase, ignoreWhitespace }: ContentSimilarityOptions = { ignoreCase: true, ignoreWhitespace: true },
) {
  return createScorer({
    name: 'Content Similarity Scorer',
    description: 'Calculates content similarity between input and output messages using string comparison algorithms.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let processedInput = run.input?.inputMessages.map((i: { content: string }) => i.content).join(', ') || '';
      let processedOutput = run.output.map((i: { content: string }) => i.content).join(', ') || '';

      if (ignoreCase) {
        processedInput = processedInput.toLowerCase();
        processedOutput = processedOutput.toLowerCase();
      }

      if (ignoreWhitespace) {
        processedInput = processedInput.replace(/\s+/g, ' ').trim();
        processedOutput = processedOutput.replace(/\s+/g, ' ').trim();
      }

      return {
        processedInput,
        processedOutput,
      };
    })
    .generateScore(({ results }) => {
      const similarity = stringSimilarity.compareTwoStrings(
        results.preprocessStepResult?.processedInput,
        results.preprocessStepResult?.processedOutput,
      );

      return similarity;
    });
}
