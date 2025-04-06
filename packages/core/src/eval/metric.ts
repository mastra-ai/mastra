import type { EvaluationResult } from './evaluator';

export abstract class Metric {
  abstract measure(input: string, output: string): Promise<EvaluationResult>;
}
