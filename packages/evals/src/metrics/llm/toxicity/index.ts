import { Metric } from '@mastra/core/eval';
import type { EvaluationResult } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { Toxicity } from '../../../evaluators/llm/toxicity/index';

export interface ToxicityMetricOptions {
  scale?: number;
}

export class ToxicityMetric extends Metric {
  private evaluator: Toxicity;

  constructor(model: LanguageModel, { scale = 1 }: ToxicityMetricOptions = {}) {
    super();
    this.evaluator = new Toxicity({ model, scale });
  }

  async measure(input: string, output: string): Promise<EvaluationResult> {
    const result = await this.evaluator.score({ input, output });

    return result;
  }
}
