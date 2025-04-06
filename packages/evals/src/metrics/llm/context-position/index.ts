import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { ContextPosition } from '../../../evaluators/llm/context-position/index';

export interface ContextPositionMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextPositionMetric extends Metric {
  private evaluator: ContextPosition;

  constructor(model: LanguageModel, { scale = 1, context }: ContextPositionMetricOptions) {
    super();
    this.evaluator = new ContextPosition({ model, scale, context });
  }

  async measure(input: string, output: string) {
    return this.evaluator.score({ input, output });
  }
}
