import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { ContextualRecallJudge } from './metricJudge';

export interface ContextualRecallMetricOptions {
  scale?: number;
}

export class ContextualRecallMetric extends Metric {
  private judge: ContextualRecallJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: ContextualRecallMetricOptions = {}) {
    super();
    this.judge = new ContextualRecallJudge(model);
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
    const verdicts = await this.judge.evaluate(input, output, context);
    const score = this.calculateScore(verdicts);

    return {
      score,
    };
  }

  private calculateScore(verdicts: { verdict: string; reason: string }[]): number {
    const totalVerdicts = verdicts?.length || 0;
    if (totalVerdicts === 0) {
      return 0;
    }

    const justifiedVerdicts = verdicts.filter(v => v.verdict === 'yes');

    const score = justifiedVerdicts.length / totalVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
