import { Metric } from '@mastra/core/eval';
import { type LanguageModel } from '@mastra/core/llm';

import { type MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { ContextPositionJudge } from './metricJudge';

export interface ContextPositionMetricOptions {
  scale?: number;
  context: string[];
}

export class ContextPositionMetric extends Metric {
  private judge: ContextPositionJudge;
  private scale: number;
  private context: string[];

  constructor(model: LanguageModel, { scale = 1, context }: ContextPositionMetricOptions) {
    super();

    this.context = context;
    this.judge = new ContextPositionJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<MetricResultWithReason> {
    const verdicts = await this.judge.evaluate(input, output, this.context);
    const score = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({ input, output, score, scale: this.scale, verdicts });

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

    // Convert to binary scores (1 for yes, 0 for no)
    const binaryScores = verdicts.map(v => (v.verdict.trim().toLowerCase() === 'yes' ? 1 : 0));

    let weightedSum = 0;
    let maxPossibleSum = 0; // Track the maximum possible sum for normalization

    // Calculate position-weighted scores
    binaryScores.forEach((isRelevant, index) => {
      const positionWeight = 1 / (index + 1);
      if (isRelevant) {
        weightedSum += positionWeight;
      }
      maxPossibleSum += positionWeight; // Add to max possible sum regardless of relevance
    });

    if (weightedSum === 0) {
      return 0;
    }

    // Normalize against the maximum possible score
    const finalScore = (weightedSum / maxPossibleSum) * this.scale;
    return roundToTwoDecimals(finalScore);
  }
}
