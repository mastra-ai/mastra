import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { ContextPrecisionJudge } from './metricJudge';

export class ContextPrecisionMetric extends Metric {
  private judge: ContextPrecisionJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 10 }: { scale?: number } = {}) {
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
    const reason = await this.judge.getReason(input, output, score, verdicts);

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
    return finalScore * this.scale;
  }
}
