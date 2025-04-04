export interface EvaluationResult {
  score: number;
  info?: Record<string, any>;
  output?: string;
}

/**
 * Abstract base class for all evaluators in Mastra.
 * This provides a common interface for different types of evaluators (LLM-based, code-based, etc.)
 * allowing them to be used interchangeably in evaluation workflows.
 */
export abstract class Evaluator {
  /**
   * The name of the evaluator.
   */
  abstract get name(): string;

  /**
   * Evaluates the input and output and returns a score.
   *
   * @param params - The parameters for the evaluation
   * @param params.input - The input to evaluate
   * @param params.output - The output to evaluate
   * @param params.options - Additional options for the evaluation
   * @returns A promise that resolves to a EvaluationResult
   */
  abstract score(params: { input: string; output: string; options?: Record<string, any> }): Promise<EvaluationResult>;
}

/**
 * Interface for evaluator settings that can be used across different evaluator types.
 */
export interface EvaluatorSettings {
  /**
   * The scale to normalize scores to (typically 1-10 or 0-1)
   */
  scale: number;

  /**
   * Optional weight for uncertainty in scoring
   */
  uncertaintyWeight?: number;

  /**
   * Optional context information that may be needed for evaluation
   */
  context?: string[];

  /**
   * Additional settings specific to the evaluator implementation
   */
  [key: string]: any;
}
