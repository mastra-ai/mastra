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
    // Handle empty cases
    if (!output) {
      return {
        score: 0,
        reason: 'The output is empty',
      };
    }

    if (!context || context.length === 0) {
      return {
        score: 0,
        reason: 'No context provided for verification',
      };
    }

    // Evaluate claims against context
    const verdicts = await this.judge.evaluate(output, context);
    // Calculate score and get metrics
    const score = this.calculateScore(verdicts);
    // Get detailed reason for the score
    const reason = await this.generateReason(input, output, context, score, verdicts);

    return {
      score,
      reason,
    };
  }

  private async generateReason(
    input: string,
    output: string,
    context: string[],
    score: number,
    verdicts: Array<{ verdict: string; reason: string }>,
  ): Promise<string> {
    const reasonsForVerdicts: string[] = [];
    for (const { verdict, reason } of verdicts || []) {
      if (verdict.trim().toLowerCase() === 'no') {
        reasonsForVerdicts.push(reason);
      }
    }

    return this.judge.getReason(input, output, context, score, this.scale, reasonsForVerdicts);
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
