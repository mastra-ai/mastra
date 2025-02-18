import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { ContextRelevancyJudge } from './metricJudge';

export interface ContextRelevancyOptions {
  scale?: number;
  context: string[];
}

export class ContextRelevancyMetric extends Metric {
  private judge: ContextRelevancyJudge;
  private scale: number;
  private context: string[];

  constructor(model: LanguageModel, { scale = 1, context }: ContextRelevancyOptions) {
    super();

    this.context = context;
    this.judge = new ContextRelevancyJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output, this.context);
    const score = this.calculateScore(verdicts);

    const irrelevancies = verdicts.filter(v => v.verdict.toLowerCase() === 'no').map(v => v.reason);
    const relevantStatements = verdicts.filter(v => v.verdict.toLowerCase() === 'no').map(v => v.reason);
    const reason = await this.judge.getReason({
      input,
      irrelevancies,
      relevantStatements,
      score,
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

    const relevantVerdicts = verdicts.filter(v => v.verdict.toLowerCase() === 'yes');

    const score = relevantVerdicts.length / totalVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
