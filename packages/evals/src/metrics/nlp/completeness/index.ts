import { Metric } from '@mastra/core/eval';
import { Completeness } from '../../../evaluators/code/completeness';

export class CompletenessMetric extends Metric {
  async measure(input: string, output: string) {
    const evaluator = new Completeness();
    const score = await evaluator.score({ input, output });

    return {
      score: score.score,
      info: score.info,
    };
  }
}
