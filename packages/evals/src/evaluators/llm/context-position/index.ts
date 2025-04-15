import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import {
  AGENT_INSTRUCTIONS,
  generateReasonPrompt,
  generateEvaluationPrompt,
  REASON_TEMPLATE,
  EVAL_TEMPLATE,
} from './prompts';
import { calculateContextPositionScore } from './score';

export interface ContextPositionOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Context Position evaluator class that extends LLMEvaluator
 * Evaluates how well context pieces are positioned based on their relevance to the output
 */
export class ContextPosition extends LLMEvaluator {
  constructor(options: ContextPositionOptions) {
    super({
      name: 'Context Position',
      instructions: AGENT_INSTRUCTIONS,
      model: options.model,
      reasonPrompt: {
        template: REASON_TEMPLATE,
        format: generateReasonPrompt,
      },
      evalPrompt: {
        template: EVAL_TEMPLATE,
        format: generateEvaluationPrompt,
      },
      scorer: calculateContextPositionScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
