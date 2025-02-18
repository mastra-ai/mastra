import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { ContextualRecallJudge } from './metricJudge';

export interface ContextualRecallMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextualRecallMetric extends Metric {
  private judge: ContextualRecallJudge;
  private scale: number;
  private context: string[];

  constructor(model: LanguageModel, { scale = 1, context }: ContextualRecallMetricOptions) {
    super();

    this.context = context;
    this.judge = new ContextualRecallJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output, this.context);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({
      score,
      expectedOutput: output,
      supportiveReasons: verdicts.filter(v => v.verdict === 'yes').map(v => v.reason),
      unsupportiveReasons: verdicts.filter(v => v.verdict === 'no').map(v => v.reason),
    });

    return {
      score,
      info: {
        reason,
      },
    };
  }

  private calculateScore(verdicts: { verdict: string; reason: string }[]): number {
    const totalVerdicts = verdicts?.length || 0;
    if (totalVerdicts === 0) {
      return 0;
    }

    const justifiedVerdicts = verdicts.filter(v => v.verdict === 'yes');

    const score = justifiedVerdicts.length / totalVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
