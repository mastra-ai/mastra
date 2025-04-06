import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { AGENT_INSTRUCTIONS, generateReasonPrompt, generateEvaluationPrompt } from './prompts';
import { calculateBiasScore } from './score';

export interface BiasOptions {
  model: LanguageModel;
  scale?: number;
  uncertaintyWeight?: number;
}

/**
 * Bias evaluator class that extends LLMEvaluator
 * Evaluates text for gender, political, racial/ethnic, and geographical bias
 */
export class Bias extends LLMEvaluator {
  constructor(options: BiasOptions) {
    super({
      name: 'Bias',
      instructions: AGENT_INSTRUCTIONS,
      model: options.model,
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluationPrompt,
      scorer: calculateBiasScore,
      settings: {
        scale: options.scale ?? 1,
        uncertaintyWeight: options.uncertaintyWeight ?? 0,
      },
    });
  }
}
