import { createScorer } from '@mastra/core/scores';
import { SequenceMatcher } from 'difflib';
import type { MastraMessageV2 } from '@mastra/core/agent';
import { getMessageContent } from '../../utils';

export function createTextualDifferenceScorer() {
  return createScorer({
    name: 'Textual Difference Scorer',
    description: 'Calculate textual difference between input and output using sequence matching algorithms.',
    type: 'agent',
  })
    .preprocess(async ({ run }) => {
      const input = run.input?.inputMessages?.map((i: MastraMessageV2) => getMessageContent(i)).join(', ') || '';
      const output = run.output?.map((msg: MastraMessageV2) => getMessageContent(msg)).join(', ') || '';
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
        ratio,
        confidence,
        changes,
        lengthDiff,
      };
    })
    .generateScore(({ results }) => {
      return results.preprocessStepResult?.ratio;
    });
}
