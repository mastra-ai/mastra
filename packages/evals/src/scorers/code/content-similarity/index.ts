import { createScorer } from '@mastra/core/scores';
import stringSimilarity from 'string-similarity';
import type { MastraMessageV2 } from '@mastra/core/agent';
import { getMessageContent } from '../../utils';

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
      let processedInput = run.input?.inputMessages.map((i: MastraMessageV2) => getMessageContent(i)).join(', ') || '';
      let processedOutput = run.output.map((msg: MastraMessageV2) => getMessageContent(msg)).join(', ') || '';

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
