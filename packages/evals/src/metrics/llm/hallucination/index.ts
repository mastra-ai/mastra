import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { HallucinationJudge } from './metricJudge';

export interface HallucinationMetricOptions {
  scale?: number;
}

export class HallucinationMetric extends Metric {
  private judge: HallucinationJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: HallucinationMetricOptions = {}) {
    super();
    this.judge = new HallucinationJudge(model);
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
    const totalStatements = verdicts.length;
    const contradictedStatements = verdicts.filter(v => v.verdict === 'yes').length;

    if (totalStatements === 0) {
      return 0;
    }

    const score = (contradictedStatements / totalStatements) * this.scale;

    return roundToTwoDecimals(score);
  }
}
