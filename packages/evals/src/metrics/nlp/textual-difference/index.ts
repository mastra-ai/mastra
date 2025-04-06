import { Metric } from '@mastra/core/eval';
import type { EvaluationResult } from '@mastra/core/eval';
import { TextualDifference } from '../../../evaluators/code/textual-difference';
import type { TextualDifferenceOptions } from '../../../evaluators/code/textual-difference';

export class TextualDifferenceMetric extends Metric {
  private evaluator: TextualDifference;

  constructor(options: TextualDifferenceOptions = {}) {
    super();
    this.evaluator = new TextualDifference(options);
  }

  async measure(input: string, output: string): Promise<EvaluationResult> {
    const result = await this.evaluator.score({ input, output });
    return result;
  }
}
