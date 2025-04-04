import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { ContextPrecision } from '../../../evaluators/llm/context-precision/index';

export interface ContextPrecisionMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextPrecisionMetric extends Metric {
  private evaluator: ContextPrecision;

  constructor(model: LanguageModel, { scale = 1, context }: ContextPrecisionMetricOptions) {
    super();
    this.evaluator = new ContextPrecision({ model, scale, context });
  }

  async measure(input: string, output: string) {
    return this.evaluator.score({ input, output });
  }
}
