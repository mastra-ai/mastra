import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import stringSimilarity from 'string-similarity';

interface ContentSimilarityOptions {
  ignoreCase?: boolean;
  ignoreWhitespace?: boolean;
}

export function createContentSimilarityScorer(
  { ignoreCase, ignoreWhitespace }: ContentSimilarityOptions = { ignoreCase: true, ignoreWhitespace: true },
) {
  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
  })
    .preprocess(async ({ run }) => {
      let processedInput =
        run.input?.inputMessages
          .map((message: any) => {
            if (typeof message.content === 'string') return message.content;
            if (Array.isArray(message.content)) {
              return message.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('');
            }
            return '';
          })
          .join(', ') || '';
      let processedOutput =
        run.output
          .map((message: any) => {
            if (typeof message.content === 'string') return message.content;
            if (Array.isArray(message.content)) {
              return message.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('');
            }
            return '';
          })
          .join(', ') || '';

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
