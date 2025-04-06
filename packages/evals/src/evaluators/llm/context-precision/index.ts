import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { AGENT_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';
import { calculateContextPrecisionScore } from './score';

export interface ContextPrecisionOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Context Precision evaluator class that extends LLMEvaluator
 * Evaluates how relevant the context pieces are to generating the expected output
 */
export class ContextPrecision extends LLMEvaluator {
  constructor(options: ContextPrecisionOptions) {
    super({
      name: 'Context Precision',
      instructions: AGENT_INSTRUCTIONS,
      model: options.model,
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluationPrompt,
      scorer: calculateContextPrecisionScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
