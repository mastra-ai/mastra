import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { FaithfulnessJudge } from './metricJudge';

export interface FaithfulnessMetricOptions {
  scale?: number;
}

export class FaithfulnessMetric extends Metric {
  private judge: FaithfulnessJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: FaithfulnessMetricOptions = {}) {
    super();
    this.judge = new FaithfulnessJudge(model);
    this.scale = scale;
  }

  async measure({
    input,
    output,
    context,
  }: {
    input: string;
    output: string;
    context: string[];
  }): Promise<MetricResult> {
    const verdicts = await this.judge.evaluate(output, context);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason(input, output, context, score, this.scale, verdicts);

    return {
      score,
      reason,
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
