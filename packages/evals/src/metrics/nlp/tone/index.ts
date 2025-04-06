import { Metric } from '@mastra/core/eval';
import type { EvaluationResult } from '@mastra/core/eval';
import { ToneConsistency } from '../../../evaluators/code/tone';
import type { ToneOptions } from '../../../evaluators/code/tone';

export class ToneConsistencyMetric extends Metric {
  private evaluator: ToneConsistency;

  constructor(options: ToneOptions = {}) {
    super();
    this.evaluator = new ToneConsistency(options);
  }

  async measure(input: string, output: string): Promise<EvaluationResult> {
    const result = await this.evaluator.score({ input, output });
    return result;
  }
}
