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
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
    extract: async run => {
      let processedInput = run.input.map(i => i.content).join(', ');
      let processedOutput = run.output.text;

      if (ignoreCase) {
        processedInput = processedInput.toLowerCase();
        processedOutput = processedOutput.toLowerCase();
      }

      if (ignoreWhitespace) {
        processedInput = processedInput.replace(/\s+/g, ' ').trim();
        processedOutput = processedOutput.replace(/\s+/g, ' ').trim();
      }

      return {
        result: {
          processedInput,
          processedOutput,
        },
      };
    },
    analyze: async run => {
      const similarity = stringSimilarity.compareTwoStrings(
        run.extractStepResult?.processedInput,
        run.extractStepResult?.processedOutput,
      );

      return {
        score: similarity,
        result: {
          similarity,
        },
      };
    },
  });
}
