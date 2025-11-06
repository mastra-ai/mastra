import { createScorer } from '@mastra/core/evals';
import keyword_extractor from 'keyword-extractor';
import { getTextContentFromMastraDBMessage } from '../../utils';

export function createKeywordCoverageScorer() {
  return createScorer({
    id: 'keyword-coverage-scorer',
    name: 'Keyword Coverage Scorer',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const input = run.input?.inputMessages?.map(i => getTextContentFromMastraDBMessage(i)).join(', ') || '';
      const output = run.output?.map(i => getTextContentFromMastraDBMessage(i)).join(', ') || '';

      if (!input && !output) {
        return {
          result: {
            referenceKeywords: new Set<string>(),
            responseKeywords: new Set<string>(),
          },
        };
      }

      const extractKeywords = (text: string) => {
        return keyword_extractor.extract(text, {
          language: 'english',
          remove_digits: true,
          return_changed_case: true,
          remove_duplicates: true,
        });
      };

      const referenceKeywords = new Set(extractKeywords(input));
      const responseKeywords = new Set(extractKeywords(output));
      return {
        referenceKeywords,
        responseKeywords,
      };
    })
    .analyze(async ({ results }) => {
      if (
        !results.preprocessStepResult?.referenceKeywords?.size &&
        !results.preprocessStepResult?.responseKeywords?.size
      ) {
        return {
          totalKeywordsLength: 0,
          matchedKeywordsLength: 0,
        };
      }

      const matchedKeywords = [...results.preprocessStepResult?.referenceKeywords].filter(k =>
        results.preprocessStepResult?.responseKeywords?.has(k),
      );

      return {
        totalKeywordsLength: Array.from(results.preprocessStepResult?.referenceKeywords).length ?? 0,
        matchedKeywordsLength: matchedKeywords.length ?? 0,
      };
    })
    .generateScore(({ results }) => {
      if (!results.analyzeStepResult?.totalKeywordsLength) {
        return 1;
      }

      const totalKeywords = results.analyzeStepResult?.totalKeywordsLength!;
      const matchedKeywords = results.analyzeStepResult?.matchedKeywordsLength!;
      return totalKeywords > 0 ? matchedKeywords / totalKeywords : 0;
    });
}
