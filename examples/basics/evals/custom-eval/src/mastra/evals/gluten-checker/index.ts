import { EvaluationResult, Metric } from '@mastra/core/eval';
import { type LanguageModel } from '@mastra/core/llm';

import { GlutenCheckerJudge } from './metricJudge';

export class GlutenCheckerMetric extends Metric {
  private judge: GlutenCheckerJudge;
  constructor(model: LanguageModel) {
    super();

    this.judge = new GlutenCheckerJudge(model);
  }

  async measure(output: string): Promise<EvaluationResult> {
    const { isGlutenFree, glutenSources } = await this.judge.evaluate(output);
    const score = await this.calculateScore(isGlutenFree);
    const reason = await this.judge.getReason({
      isGlutenFree,
      glutenSources,
    });

    return {
      score,
      info: {
        glutenSources,
        reason,
      },
    };
  }

  async calculateScore(isGlutenFree: boolean): Promise<number> {
    return isGlutenFree ? 1 : 0;
  }
}
