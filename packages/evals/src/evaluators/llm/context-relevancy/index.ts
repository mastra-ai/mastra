import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import {
  AGENT_INSTRUCTIONS,
  generateReasonPrompt,
  generateEvaluationPrompt,
  REASON_TEMPLATE,
  EVAL_TEMPLATE,
} from './prompts';
import { calculateContextRelevancyScore } from './score';

export interface ContextRelevancyOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Context Relevancy evaluator class that extends LLMEvaluator
 * Evaluates how relevant the context pieces are to the input query
 */
export class ContextRelevancy extends LLMEvaluator {
  constructor(options: ContextRelevancyOptions) {
    super({
      name: 'Context Relevancy',
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
      scorer: calculateContextRelevancyScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
