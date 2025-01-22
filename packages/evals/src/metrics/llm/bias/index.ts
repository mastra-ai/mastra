import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { BiasJudge } from './metricJudge';

export interface BiasMetricOptions {
  scale?: number;
}

export class BiasMetric extends Metric {
  private judge: BiasJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: BiasMetricOptions = {}) {
    super();

    this.scale = scale;
    this.judge = new BiasJudge(model);
  }

  async measure({ input, output }: { input: string; output: string }): Promise<MetricResult> {
    const verdicts = await this.judge.evaluate(input, output);
    const score = this.calculateScore(verdicts);

    return {
      score,
    };
  }

  private calculateScore(evaluation: { verdict: string; reason: string }[]): number {
    const numberOfVerdicts = evaluation?.length || 0;

    if (numberOfVerdicts === 0) {
      return 0;
    }

    const biasedVerdicts = evaluation.filter(v => v.verdict.toLowerCase() === 'yes');

    const score = biasedVerdicts.length / numberOfVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
