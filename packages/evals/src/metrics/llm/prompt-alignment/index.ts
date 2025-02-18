import { Metric } from '@mastra/core/eval';
import type { LanguageModel } from '@mastra/core/llm';

import type { MetricResultWithReason } from '../types';
import { roundToTwoDecimals } from '../utils';

import { PromptAlignmentJudge } from './metricJudge';

export interface PromptAlignmentMetricOptions {
  scale?: number;
  instructions: string[];
}

export interface PromptAlignmentScore {
  score: number;
  totalInstructions: number;
  applicableInstructions: number;
  followedInstructions: number;
  naInstructions: number;
}

export interface PromptAlignmentMetricResult extends MetricResultWithReason {
  info: MetricResultWithReason['info'] & {
    scoreDetails: {
      totalInstructions: number;
      applicableInstructions: number;
      followedInstructions: number;
      naInstructions: number;
    };
  };
}

export class PromptAlignmentMetric extends Metric {
  private instructions: string[];
  private judge: PromptAlignmentJudge;
  private scale: number;

  constructor(model: LanguageModel, { instructions, scale = 1 }: PromptAlignmentMetricOptions) {
    super();

    this.instructions = instructions;
    this.judge = new PromptAlignmentJudge(model);
    this.scale = scale;
  }

  async measure(input: string, output: string): Promise<PromptAlignmentMetricResult> {
    const verdicts = await this.judge.evaluate(input, output, this.instructions);
    const scoreDetails = this.calculateScore(verdicts);
    const reason = await this.judge.getReason({
      input,
      output,
      score: scoreDetails.score,
      verdicts,
      scale: this.scale,
    });

    return {
      score: scoreDetails.score,
      info: {
        reason,
        scoreDetails: {
          totalInstructions: scoreDetails.totalInstructions,
          applicableInstructions: scoreDetails.applicableInstructions,
          followedInstructions: scoreDetails.followedInstructions,
          naInstructions: scoreDetails.naInstructions,
        },
      },
    };
  }

  private calculateScore(evaluation: { verdict: string; reason: string }[]): PromptAlignmentScore {
    const totalInstructions = evaluation?.length || 0;

    // Handle empty evaluation case
    if (totalInstructions === 0) {
      return {
        score: 0,
        totalInstructions: 0,
        applicableInstructions: 0,
        followedInstructions: 0,
        naInstructions: 0,
      };
    }

    // Count different verdict types
    const counts = evaluation.reduce(
      (acc, { verdict }) => {
        const normalizedVerdict = verdict.trim().toLowerCase();
        if (normalizedVerdict === 'n/a') {
          acc.naCount++;
        } else if (normalizedVerdict === 'yes') {
          acc.alignmentCount++;
          acc.applicableCount++;
        } else if (normalizedVerdict === 'no') {
          acc.applicableCount++;
        }
        return acc;
      },
      { naCount: 0, alignmentCount: 0, applicableCount: 0 },
    );

    // Calculate final score
    const score =
      counts.applicableCount > 0
        ? roundToTwoDecimals((counts.alignmentCount / counts.applicableCount) * this.scale)
        : 0;

    return {
      score,
      totalInstructions,
      applicableInstructions: counts.applicableCount,
      followedInstructions: counts.alignmentCount,
      naInstructions: counts.naCount,
    };
  }
}
