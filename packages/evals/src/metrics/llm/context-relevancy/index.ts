import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { ContextRelevancyJudge } from './metricJudge';

export interface ContextRelevancyOptions {
  scale?: number;
}

export class ContextRelevancyMetric extends Metric {
  private judge: ContextRelevancyJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: ContextRelevancyOptions = {}) {
    super();
    this.judge = new ContextRelevancyJudge(model);
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

    const relevantVerdicts = verdicts.filter(v => v.verdict.toLowerCase() === 'yes');

    const score = relevantVerdicts.length / totalVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
