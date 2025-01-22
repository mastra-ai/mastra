import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { SummarizationJudge } from './metricJudge';

export interface SummarizationMetricOptions {
  scale?: number;
}

export class SummarizationMetric extends Metric {
  private judge: SummarizationJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: SummarizationMetricOptions = {}) {
    super();

    this.judge = new SummarizationJudge(model);
    this.scale = scale;
  }

  async measure({ input, output }: { input: string; output: string }): Promise<MetricResult> {
    const alignmentVerdicts = await this.judge.evaluateAlignment(input, output);
    const coverageVerdicts = await this.judge.evaluateCoverage(input, output);

    const alignmentScore = this.calculateScore(alignmentVerdicts);
    const coverageScore = this.calculateScore(coverageVerdicts);
    const finalScore = Math.min(alignmentScore, coverageScore);

    const reason = await this.judge.getReason(
      input,
      output,
      alignmentScore,
      coverageScore,
      finalScore,
      this.scale,
      alignmentVerdicts,
      coverageVerdicts,
    );

    return {
      score: finalScore,
      reason,
    };
  }

  private calculateScore(evaluation: { verdict: string; reason: string }[]): number {
    const numberOfVerdicts = evaluation?.length || 0;
    if (numberOfVerdicts === 0) {
      return 0;
    }

    let positiveCount = 0;
    for (const { verdict } of evaluation!) {
      if (verdict.trim().toLowerCase() === 'yes') {
        positiveCount++;
      }
    }

    const score = positiveCount / numberOfVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
