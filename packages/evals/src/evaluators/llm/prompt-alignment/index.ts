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

export interface PromptAlignmentOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
  context: string[];
}

/**
 * Prompt Alignment evaluator class that extends LLMEvaluator
 * Evaluates how well an LLM's output follows the given prompt instructions
 */
export class PromptAlignment extends LLMEvaluator {
  constructor(options: PromptAlignmentOptions) {
    super({
      name: 'Prompt Alignment',
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
