import { Metric } from '@mastra/core/eval';
import type { ModelConfig } from '@mastra/core/llm';

import { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { HallucinationJudge } from './metricJudge';

export interface HallucinationMetricOptions {
  scale?: number;
  context: string[];
}

export class HallucinationMetric extends Metric {
  private judge: HallucinationJudge;
  private scale: number;
  private context: string[];

  constructor(model: ModelConfig, { scale = 1, context }: HallucinationMetricOptions) {
    super();
    this.judge = new HallucinationJudge(model);
    this.scale = scale;
    this.context = context;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(output, this.context);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({
      input,
      output,
      context: this.context,
      score,
      scale: this.scale,
      verdicts,
    });

    return {
      score,
      info: {
        reason,
      },
    };
  }

  private calculateScore(verdicts: Array<{ verdict: string; reason: string }>): number {
    const totalStatements = verdicts.length;
    const contradictedStatements = verdicts.filter(v => v.verdict === 'yes').length;

    if (totalStatements === 0) {
      return 0;
    }

    const score = (contradictedStatements / totalStatements) * this.scale;

    return roundToTwoDecimals(score);
  }
}
