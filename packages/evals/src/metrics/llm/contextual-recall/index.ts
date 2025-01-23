import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { ContextualRecallJudge } from './metricJudge';

export interface ContextualRecallMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextualRecallMetric extends Metric {
  private judge: ContextualRecallJudge;
  private scale: number;
  private context: string[];

  constructor(model: ModelConfig, { scale = 1, context }: ContextualRecallMetricOptions) {
    super();
    this.judge = new ContextualRecallJudge(model);
    this.scale = scale;
    this.context = context;
  }

  async measure(input: string, output: string): Promise<MetricResult> {
    const verdicts = await this.judge.evaluate(input, output, this.context);
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
