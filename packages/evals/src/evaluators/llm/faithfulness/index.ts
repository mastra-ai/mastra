import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import {
  AGENT_INSTRUCTIONS,
  generateReasonPrompt,
  generateEvaluationPrompt,
  REASON_TEMPLATE,
  EVAL_TEMPLATE,
} from './prompts';
import { calculateFaithfulnessScore } from './score';

export interface FaithfulnessOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Faithfulness evaluator class that extends LLMEvaluator
 * Evaluates how factually consistent the output is with the provided context
 */
export class Faithfulness extends LLMEvaluator {
  constructor(options: FaithfulnessOptions) {
    super({
      name: 'Faithfulness',
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
      scorer: calculateFaithfulnessScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
