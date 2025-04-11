import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import {
  AGENT_INSTRUCTIONS,
  generateReasonPrompt,
  generateEvaluationPrompt,
  REASON_TEMPLATE,
  EVAL_TEMPLATE,
} from './prompts';
import { calculateScore } from './score';

export interface HallucinationOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context?: string[];
}

/**
 * Hallucination evaluator class that extends LLMEvaluator
 * Evaluates how much an LLM's output contains information not supported by the provided context
 */
export class Hallucination extends LLMEvaluator {
  constructor(options: HallucinationOptions) {
    super({
      name: 'Hallucination',
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
      scorer: calculateScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
