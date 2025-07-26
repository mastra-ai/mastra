import { createScorer } from '@mastra/core/scores';
import { SequenceMatcher } from 'difflib';

export function createTextualDifferenceScorer() {
  return createScorer({
    name: 'Completeness',
    description:
      'Leverage the nlp method from "compromise" to extract elements from the input and output and calculate the coverage.',
    analyze: async run => {
      const input = run.input?.map(i => i.content).join(', ') || '';
      const output = run.output.text;
      const matcher = new SequenceMatcher(null, input, output);
      const ratio = matcher.ratio();

      // Get detailed operations
      const ops = matcher.getOpcodes();
      const changes = ops.filter(([op]) => op !== 'equal').length;

      // Calculate confidence based on text length difference
      const maxLength = Math.max(input.length, output.length);
      const lengthDiff = maxLength > 0 ? Math.abs(input.length - output.length) / maxLength : 0;
      const confidence = 1 - lengthDiff;

      return {
        score: ratio,
        result: {
          confidence,
          changes,
          lengthDiff,
        },
      };
    },
  });
}
