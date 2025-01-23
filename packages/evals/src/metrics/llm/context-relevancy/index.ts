import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { ContextRelevancyJudge } from './metricJudge';

export interface ContextRelevancyOptions {
  scale?: number;
  context: string[];
}

export class ContextRelevancyMetric extends Metric {
  private judge: ContextRelevancyJudge;
  private scale: number;
  private context: string[];

  constructor(model: ModelConfig, { scale = 1, context }: ContextRelevancyOptions) {
    super();
    this.judge = new ContextRelevancyJudge(model);
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

    const relevantVerdicts = verdicts.filter(v => v.verdict.toLowerCase() === 'yes');

    const score = relevantVerdicts.length / totalVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
