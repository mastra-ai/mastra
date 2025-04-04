import { Metric } from '@mastra/core/eval';
import type { EvaluationResult } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';
import { PromptAlignment } from '../../../evaluators/llm/prompt-alignment/index';

export interface PromptAlignmentMetricOptions {
  scale?: number;
  instructions: string[];
}
export class PromptAlignmentMetric extends Metric {
  private evaluator: PromptAlignment;

  constructor(model: LanguageModel, { instructions, scale = 1 }: PromptAlignmentMetricOptions) {
    super();
    this.evaluator = new PromptAlignment({ model, scale, context: instructions });
  }

  async measure(input: string, output: string): Promise<EvaluationResult> {
    const result = await this.evaluator.score({ input, output });

    return result;
  }
}
