import { createScorer } from '@mastra/core/evals';
import stringSimilarity from 'string-similarity';
import { getTextContentFromMastraDBMessage } from '../../utils';

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

/**
 * Like stringSimilarity.compareTwoStrings (Dice coefficient of character pairs), but whitespace counts
 */
function compareWithWhitespace(first: string, second: string): number {
  if (first === second) return 1;
  if (first.length < 2 || second.length < 2) return 0;

  const pairs = new Map<string, number>();
  for (let i = 0; i < first.length - 1; i++) {
    const pair = first.slice(i, i + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }

  let matches = 0;
  for (let i = 0; i < second.length - 1; i++) {
    const pair = second.slice(i, i + 2);
    const left = pairs.get(pair) ?? 0;
    if (left > 0) {
      pairs.set(pair, left - 1);
      matches++;
    }
  }

  return (2 * matches) / (first.length + second.length - 2);
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
      const compare = ignoreWhitespace ? stringSimilarity.compareTwoStrings : compareWithWhitespace;

      return compare(results.preprocessStepResult?.processedInput, results.preprocessStepResult?.processedOutput);
    });
}
