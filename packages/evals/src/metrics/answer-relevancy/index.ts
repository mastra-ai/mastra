import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../../utils';

import { AnswerRelevancyJudge } from './metricJudge';

export interface AnswerRelevancyMetricOptions {
  uncertaintyWeight?: number;
  scale?: number;
}

export class AnswerRelevancyMetric extends Metric {
  private judge: AnswerRelevancyJudge;
  private uncertaintyWeight: number;
  private scale: number;

  constructor(model: ModelConfig, { uncertaintyWeight = 0.3, scale = 10 }: AnswerRelevancyMetricOptions = {}) {
    super();

    this.uncertaintyWeight = uncertaintyWeight;
    this.judge = new AnswerRelevancyJudge(model);
    this.scale = scale;
  }

  async measure({ input, output }: { input: string; output: string }): Promise<MetricResult> {
    const verdicts = await this.judge.evaluate(input, output);
    const score = this.calculateScore(verdicts);

    const reason = await this.generateReason(input, output, score, verdicts);

    return {
      score,
      reason,
    };
  }

  private async generateReason(
    input: string,
    output: string,
    score: number,
    verdicts: {
      verdict: string;
      reason: string;
    }[],
  ): Promise<string> {
    const reasonsForVerdicts: string[] = [];
    for (const { verdict, reason } of verdicts || []) {
      if (verdict.trim().toLowerCase() === 'no') {
        reasonsForVerdicts.push(reason);
      }
    }

    const reason = await this.judge.getReason(input, output, score, this.scale, reasonsForVerdicts);
    return reason;
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
