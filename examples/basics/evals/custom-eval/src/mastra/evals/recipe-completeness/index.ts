import { Metric, type MetricResult } from '@mastra/core/eval';
import { type LanguageModel } from '@mastra/core/llm';

import { RecipeCompletenessJudge } from './metricJudge';

export interface RecipeCompletenessMetricOptions {
  scale?: number;
}

export interface MetricResultWithInfo extends MetricResult {
  info: {
    reason: string;
    missing: string[];
  };
}

export class RecipeCompletenessMetric extends Metric {
  private judge: RecipeCompletenessJudge;
  private scale: number;
  constructor(model: LanguageModel, { scale = 1 }: RecipeCompletenessMetricOptions = {}) {
    super();

    this.judge = new RecipeCompletenessJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithInfo> {
    const { verdict, missing } = await this.judge.evaluate(input, output);
    const score = this.calculateScore({ verdict });
    const reason = await this.judge.getReason({
      input,
      output,
      score,
      scale: this.scale,
      verdict,
      missing,
    });

    return {
      score,
      info: {
        missing,
        reason,
      },
    };
  }

  private calculateScore(verdict: { verdict: string }): number {
    return verdict.verdict.toLowerCase() === 'incomplete' ? 0 : 1;
  }
}
