import { createScorer } from '@mastra/core/eval';
import keyword_extractor from 'keyword-extractor';

export function createKeywordCoverageScorer() {
  return createScorer({
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
    extract: async run => {
      const input = run.input.map(i => i.content).join(', ');
      const output = run.output.text;
      console.log({
        input,
        output,
      });
      if (!input && !output) {
        return {
          referenceKeywords: new Set<string>(),
          responseKeywords: new Set<string>(),
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
    },
    analyze: async run => {
      if (!run.extractStepResult?.referenceKeywords.size && !run.extractStepResult?.responseKeywords.size) {
        return {
          score: 1,
          totalKeywords: 0,
          matchedKeywords: 0,
        };
      }

      const matchedKeywords = [...run.extractStepResult?.referenceKeywords].filter(k =>
        run.extractStepResult?.responseKeywords.has(k),
      );
      const totalKeywords = run.extractStepResult?.referenceKeywords.size;
      const coverage = totalKeywords > 0 ? matchedKeywords.length / totalKeywords : 0;

      return {
        score: coverage,
        totalKeywords: run.extractStepResult?.referenceKeywords.size,
        matchedKeywords: matchedKeywords.length,
      };
    },
  });
}
