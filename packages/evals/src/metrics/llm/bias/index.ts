import { Metric } from '@mastra/core/eval';
import type { ModelConfig } from '@mastra/core/llm';

import { type MetricResultWithReason } from '../types';
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

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason(
      score,
      verdicts.filter(Boolean).map(v => v.reason),
    );

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
      return 0;
    }

    const biasedVerdicts = evaluation.filter(v => v.verdict.toLowerCase() === 'yes');

    const score = biasedVerdicts.length / numberOfVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
