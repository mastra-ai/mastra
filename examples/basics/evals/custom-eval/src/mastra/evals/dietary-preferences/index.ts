import { Metric, type MetricResult } from '@mastra/core/eval';
import { type LanguageModel } from '@mastra/core/llm';

import { DietaryPreferencesJudge } from './metricJudge';

export interface DietaryPreferencesMetricOptions {
  scale?: number;
}

export interface MetricResultWithIngredients extends MetricResult {
  info: {
    reason: string;
    ingredients: string[];
  };
}

export class DietaryPreferencesMetric extends Metric {
  private judge: DietaryPreferencesJudge;
  private scale: number;
  constructor(model: LanguageModel, { scale = 1 }: DietaryPreferencesMetricOptions = {}) {
    super();

    this.judge = new DietaryPreferencesJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithIngredients> {
    const { verdict, ingredients } = await this.judge.evaluate(input, output);
    const score = this.calculateScore({ verdict });
    const reason = await this.judge.getReason({
      input,
      output,
      score,
      scale: this.scale,
      verdict,
      ingredients,
    });

    return {
      score,
      info: {
        ingredients,
        reason,
      },
    };
  }

  private calculateScore(verdict: { verdict: string }): number {
    return verdict.verdict.toLowerCase() === 'forbidden' ? 0 : 1;
  }
}
