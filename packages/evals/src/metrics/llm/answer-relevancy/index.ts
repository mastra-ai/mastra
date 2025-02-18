import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { AnswerRelevancyJudge } from './metricJudge';

export interface AnswerRelevancyMetricOptions {
  uncertaintyWeight?: number;
  scale?: number;
}

export class AnswerRelevancyMetric extends Metric {
  private judge: AnswerRelevancyJudge;
  private uncertaintyWeight: number;
  private scale: number;

  constructor(model: LanguageModel, { uncertaintyWeight = 0.3, scale = 1 }: AnswerRelevancyMetricOptions = {}) {
    super();

    this.uncertaintyWeight = uncertaintyWeight;
    this.judge = new AnswerRelevancyJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({ input, output, score, scale: this.scale, verdicts });

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

    let relevancyCount = 0;
    for (const { verdict } of evaluation) {
      if (verdict.trim().toLowerCase() === 'yes') {
        relevancyCount++;
      } else if (verdict.trim().toLowerCase() === 'unsure') {
        relevancyCount += this.uncertaintyWeight;
      }
    }

    const score = relevancyCount / numberOfVerdicts;
    return roundToTwoDecimals(score * this.scale);
  }
}
