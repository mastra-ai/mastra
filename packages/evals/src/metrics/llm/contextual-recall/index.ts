import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { ContextualRecall } from '../../../evaluators/llm/contextual-recall/index';

export interface ContextualRecallMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextualRecallMetric extends Metric {
  private evaluator: ContextualRecall;

  constructor(model: LanguageModel, { scale = 1, context }: ContextualRecallMetricOptions) {
    super();
    this.evaluator = new ContextualRecall({ model, scale, context });
  }

  async measure(input: string, output: string) {
    return this.evaluator.score({ input, output });
  }
}
