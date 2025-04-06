import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { AGENT_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';
import { calculateContextualRecallScore } from './score';

export interface ContextualRecallOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Contextual Recall evaluator class that extends LLMEvaluator
 * Evaluates how well the output is supported by the provided context
 */
export class ContextualRecall extends LLMEvaluator {
  constructor(options: ContextualRecallOptions) {
    super({
      name: 'Contextual Recall',
      instructions: AGENT_INSTRUCTIONS,
      model: options.model,
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluationPrompt,
      scorer: calculateContextualRecallScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
