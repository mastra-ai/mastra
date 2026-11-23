import { createScorer } from '@mastra/core/evals';
import stringSimilarity from 'string-similarity';
import { getTextContentFromMastraDBMessage } from '../../utils';

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export function createContentSimilarityScorer(
  { ignoreCase, ignoreWhitespace = true }: ContentSimilarityOptions = { ignoreCase: true },
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
      // compareTwoStrings strips whitespace, so when it counts, rename each distinct character to a non-whitespace one
      const codes = new Map<string, string>();
      const encode = (text: string) =>
        ignoreWhitespace
          ? text
          : text.replace(/[^]/g, char => {
              const code = codes.get(char) ?? String.fromCharCode(0x4e00 + codes.size);
              codes.set(char, code);
              return code;
            });

      const similarity = stringSimilarity.compareTwoStrings(
        encode(results.preprocessStepResult?.processedInput),
        encode(results.preprocessStepResult?.processedOutput),
      );

      return similarity;
    });
}
