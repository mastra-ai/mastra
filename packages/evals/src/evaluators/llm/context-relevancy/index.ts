import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { AGENT_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';
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
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluationPrompt,
      scorer: calculateContextRelevancyScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
