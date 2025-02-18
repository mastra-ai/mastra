import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { SummarizationJudge } from './metricJudge';

export interface SummarizationMetricOptions {
  scale?: number;
}

export class SummarizationMetric extends Metric {
  private judge: SummarizationJudge;
  private scale: number;

  constructor(model: LanguageModel, { scale = 1 }: SummarizationMetricOptions = {}) {
    super();

    this.judge = new SummarizationJudge(model);
    this.scale = scale;
  }

  async measure(
    input: string,
    output: string,
  ): Promise<MetricResultWithReason & { info: { alignmentScore: number; coverageScore: number } }> {
    const alignmentVerdicts = await this.judge.evaluateAlignment(input, output);
    const coverageVerdicts = await this.judge.evaluateCoverage(input, output);

    const alignmentScore = this.calculateScore(alignmentVerdicts);
    const coverageScore = this.calculateScore(coverageVerdicts);
    const finalScore = Math.min(alignmentScore, coverageScore);

    const reason = await this.judge.getReason({
      originalText: input,
      summary: output,
      alignmentScore,
      coverageScore,
      finalScore,
      alignmentVerdicts,
      coverageVerdicts,
      scale: this.scale,
    });

    return {
      score: finalScore,
      info: {
        reason,
        alignmentScore,
        coverageScore,
      },
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
