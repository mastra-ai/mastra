import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { AGENT_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';
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
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluationPrompt,
      scorer: calculateScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
        context: options.context ?? [],
      },
    });
  }
}
