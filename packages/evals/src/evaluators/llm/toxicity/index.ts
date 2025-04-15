import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import {
  generateEvaluationPrompt,
  generateReasonPrompt,
  TOXICITY_AGENT_INSTRUCTIONS,
  EVAL_TEMPLATE,
  REASON_TEMPLATE,
} from './prompts';
import { calculateScore } from './score';

export class Toxicity extends LLMEvaluator {
  constructor({ model, scale }: { model: LanguageModel; scale: number }) {
    super({
      name: 'Toxicity',
      instructions: TOXICITY_AGENT_INSTRUCTIONS,
      model,
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
        scale,
      },
    });
  }
}
