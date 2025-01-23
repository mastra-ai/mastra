import { Metric, ModelConfig } from '@mastra/core';

import { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { PromptAlignmentJudge } from './metricJudge';

export interface PromptAlignmentMetricOptions {
  scale?: number;
  instructions: string[];
}

export class PromptAlignmentMetric extends Metric {
  private instructions: string[];
  private judge: PromptAlignmentJudge;
  private scale: number;

  constructor(model: ModelConfig, { instructions, scale = 1 }: PromptAlignmentMetricOptions) {
    super();

    this.instructions = instructions;
    this.judge = new PromptAlignmentJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output, this.instructions);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({
      input,
      output,
      score,
      verdicts,
      scale: this.scale,
    });

    return {
      score,
      info: {
        reason,
      },
    };
  }

  private calculateScore(evaluation: { verdict: string; reason: string }[]): number {
    const numberOfVerdicts = evaluation?.length || 0;
    if (numberOfVerdicts === 0) {
      return 1;
    }

    let alignmentCount = 0;
    for (const { verdict } of evaluation!) {
      if (verdict.trim().toLowerCase() !== 'no') {
        alignmentCount++;
      }
    }

    const score = alignmentCount / numberOfVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
