import { Metric, type ModelConfig } from '@mastra/core';

import { type MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { ToxicityJudge } from './metricJudge';

export interface ToxicityMetricOptions {
  scale?: number;
}

export class ToxicityMetric extends Metric {
  private judge: ToxicityJudge;
  private scale: number;

  constructor(model: ModelConfig, { scale = 1 }: ToxicityMetricOptions = {}) {
    super();

    this.scale = scale;
    this.judge = new ToxicityJudge(model);
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({ score, toxics: verdicts.map(v => v.reason) });

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

    let toxicityCount = 0;
    for (const { verdict } of evaluation) {
      if (verdict.trim().toLowerCase() === 'yes') {
        toxicityCount++;
      }
    }

    const score = toxicityCount / numberOfVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
