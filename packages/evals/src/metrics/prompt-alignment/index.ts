import { Metric, MetricResult } from '@mastra/core';

// import { jsonFormatter } from '../utils';
import { PromptAlignmentJudge } from './metricJudge';

export class PromptAlignmentMetric extends Metric {
  instructions: string[];
  judge: PromptAlignmentJudge;
  constructor(provider: string, name: string, instructions: string[]) {
    super();
    this.instructions = instructions;

    this.judge = new PromptAlignmentJudge(provider, name);
  }

  async measure({ input, output }: { input: string; output: string }): Promise<MetricResult> {
    const evaluation = await this.judge.evaluate(input, output, this.instructions);
    const { verdicts } = JSON.parse(evaluation);
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

    const reason = await this.judge.getReason(input, output, score, reasonsForVerdicts);
    return reason;
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
    return score * 10;
  }
}
