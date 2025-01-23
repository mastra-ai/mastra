import { Metric, MetricResult, ModelConfig } from '@mastra/core';

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

  constructor(model: ModelConfig, { scale = 1, context }: FaithfulnessMetricOptions) {
    super();
    this.scale = scale;
    this.context = context;
    this.judge = new FaithfulnessJudge(model);
  }

  // @ts-expect-error - input is unused
  async measure(input: string, output: string): Promise<MetricResult> {
    const verdicts = await this.judge.evaluate(output, this.context);
    const score = this.calculateScore(verdicts);

    return {
      score,
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
