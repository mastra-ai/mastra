import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import {
  ANSWER_RELEVANCY_INSTRUCTIONS,
  generateReasonPrompt,
  generateEvaluationPrompt,
  REASON_TEMPLATE,
  EVAL_TEMPLATE,
} from './prompts';
import { calculateAnswerRelevancyScore } from './score';

export interface AnswerRelevancyOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
}

/**
 * Creates an answer relevancy evaluator
 * @param options Options for the evaluator
 * @returns A new LLMEvaluator instance
 */
export class AnswerRelevancy extends LLMEvaluator {
  constructor({ model, scale, uncertaintyWeight }: AnswerRelevancyOptions) {
    super({
      name: 'Answer Relevancy',
      instructions: ANSWER_RELEVANCY_INSTRUCTIONS,
      model,
      reasonPrompt: {
        template: REASON_TEMPLATE,
        format: generateReasonPrompt,
      },
      evalPrompt: {
        template: EVAL_TEMPLATE,
        format: generateEvaluationPrompt,
      },
      scorer: calculateAnswerRelevancyScore,
      settings: {
        scale: scale ?? 1,
        uncertaintyWeight: uncertaintyWeight ?? 0.3,
      },
    });
  }
}
