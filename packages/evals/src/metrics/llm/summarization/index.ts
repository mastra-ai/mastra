import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import { Summarization } from '../../../evaluators/llm/summarization';

export interface SummarizationMetricOptions {
  scale?: number;
}

export class SummarizationMetric extends Metric {
  private evaluator: Summarization;
  private scale: number;

  constructor(model: LanguageModel, { scale = 1 }: SummarizationMetricOptions = {}) {
    super();

    this.evaluator = new Summarization({ model, scale });
    this.scale = scale;
  }

  async measure(input: string, output: string) {
    return this.evaluator.score({ input, output });
  }
}
