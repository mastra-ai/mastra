import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { FaithfulnessJudge } from './metricJudge';

export interface FaithfulnessMetricOptions {
  scale?: number;
  context: string[];
}

export class FaithfulnessMetric extends Metric {
  private judge: FaithfulnessJudge;
  private scale: number;
  private context: string[];

  constructor(model: LanguageModel, { scale = 1, context }: FaithfulnessMetricOptions) {
    super();

    this.context = context;
    this.judge = new FaithfulnessJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(output, this.context);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({
      input,
      output,
      context: this.context,
      score,
      scale: this.scale,
      verdicts,
    });

    return {
      score,
      info: {
        reason,
      },
    };
  }

  private calculateScore(verdicts: Array<{ verdict: string; reason: string }>): number {
    const totalClaims = verdicts.length;
    const supportedClaims = verdicts.filter(v => v.verdict === 'yes').length;

    if (totalClaims === 0) {
      return 0;
    }

    const score = (supportedClaims / totalClaims) * this.scale;

    return roundToTwoDecimals(score);
  }
}
