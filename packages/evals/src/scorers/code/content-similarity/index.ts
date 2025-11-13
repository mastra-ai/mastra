import { createScorer } from '@mastra/core/evals';
import stringSimilarity from 'string-similarity';
import { getTextContentFromMastraDBMessage } from '../../utils';

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export function createContentSimilarityScorer(
  { ignoreCase, ignoreWhitespace }: ContentSimilarityOptions = { ignoreCase: true, ignoreWhitespace: true },
) {
  return createScorer({
    id: 'content-similarity-scorer',
    name: 'Content Similarity Scorer',
    description: 'Calculates content similarity between input and output messages using string comparison algorithms.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      let processedInput = run.input?.inputMessages.map(i => getTextContentFromMastraDBMessage(i)).join(', ') || '';
      let processedOutput = run.output.map(i => getTextContentFromMastraDBMessage(i)).join(', ') || '';

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
