import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { AnswerRelevancy } from '../../../evaluators/llm/answer-relevancy/index';

export interface AnswerRelevancyMetricOptions {
  uncertaintyWeight?: number;
  scale?: number;
}

export class AnswerRelevancyMetric extends Metric {
  private evaluator: AnswerRelevancy;

  constructor(model: LanguageModel, { uncertaintyWeight = 0.3, scale = 1 }: AnswerRelevancyMetricOptions = {}) {
    super();
    this.evaluator = new AnswerRelevancy({ model, scale, uncertaintyWeight });
  }

  async measure(input: string, output: string) {
    return this.evaluator.score({ input, output });
  }
}
