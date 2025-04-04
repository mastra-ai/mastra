import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { generateEvaluatePrompt, generateReasonPrompt, TOXICITY_AGENT_INSTRUCTIONS } from './prompts';
import { calculateScore } from './score';

export class Toxicity extends LLMEvaluator {
  constructor({ model, scale }: { model: LanguageModel; scale: number }) {
    super({
      name: 'Toxicity',
      instructions: TOXICITY_AGENT_INSTRUCTIONS,
      model,
      reasonPrompt: generateReasonPrompt,
      evalPrompt: generateEvaluatePrompt,
      scorer: calculateScore,
      settings: {
        scale,
      },
    });
  }
}
