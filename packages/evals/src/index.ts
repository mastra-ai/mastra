/**
 * @mastra/evals - Evaluation framework for AI agents
 * 
 * This package provides scorers for evaluating AI agent performance.
 * Import specific scorers from subpaths:
 * 
 * @example
 * ```ts
 * import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';
 * import { getUserMessageFromRunInput } from '@mastra/evals/scorers/utils';
 * ```
 */

// Re-export commonly used utilities
export * from './scorers/utils';

// Re-export prebuilt scorers for convenience
export * from './scorers/prebuilt';
