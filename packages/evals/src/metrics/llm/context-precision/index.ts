import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { ContextPrecisionJudge } from './metricJudge';

export interface ContextPrecisionMetricOptions {
  scale?: number;
}

export class ContextPrecisionMetric extends Metric {
  private judge: ContextPrecisionJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: ContextPrecisionMetricOptions = {}) {
    super();
    this.judge = new ContextPrecisionJudge(model);
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
    const reason = await this.judge.getReason(input, output, score, this.scale, verdicts);

    return {
      score,
      reason,
    };
  }

  private calculateScore(verdicts: { verdict: string; reason: string }[]): number {
    const totalVerdicts = verdicts?.length || 0;
    if (totalVerdicts === 0) {
      return 0;
    }

    // Convert to binary scores (1 for yes, 0 for no)
    const binaryScores = verdicts.map(v => (v.verdict.trim().toLowerCase() === 'yes' ? 1 : 0));

    let weightedPrecisionSum = 0;
    let relevantCount = 0;

    // Calculate weighted precision at each position
    binaryScores.forEach((isRelevant, index) => {
      if (isRelevant) {
        relevantCount++;
        const currentPrecision = relevantCount / (index + 1);
        weightedPrecisionSum += currentPrecision * isRelevant;
      }
    });

    if (relevantCount === 0) {
      return 0;
    }

    const finalScore = weightedPrecisionSum / relevantCount;
    return roundToTwoDecimals(finalScore * this.scale);
  }
}
