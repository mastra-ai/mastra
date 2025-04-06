import type { EvaluationResult } from '@mastra/core/eval';

export type CodeScorer = ({
  input,
  output,
  options,
}: {
  input: string;
  output: string;
  options?: Record<string, any>;
}) => Promise<EvaluationResult>;

export class CodeEvaluator {
  private scorer: CodeScorer;
  private options: Record<string, any>;
  constructor(scorer: CodeScorer, options?: Record<string, any>) {
    this.scorer = scorer;
    this.options = options || {};
  }
  async score({
    input,
    output,
    options,
  }: {
    input: string;
    output: string;
    options?: Record<string, any>;
  }): Promise<EvaluationResult> {
    return await this.scorer({ input, output, options: { ...this.options, ...options } });
  }
}
