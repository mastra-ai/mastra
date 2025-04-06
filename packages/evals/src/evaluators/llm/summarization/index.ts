import type { LanguageModel } from '@mastra/core/llm';
import { LLMEvaluator } from '../evaluator';
import { generateReasonPrompt, SUMMARIZATION_AGENT_INSTRUCTIONS } from './prompts';
import { score } from './score';

export class Summarization extends LLMEvaluator {
  constructor({ model, scale }: { model: LanguageModel; scale?: number }) {
    super({
      name: 'Summarization',
      instructions: SUMMARIZATION_AGENT_INSTRUCTIONS,
      scorer: score,
      model: model,
      reasonPrompt: generateReasonPrompt,
      settings: {
        scale: scale ?? 1,
      },
    });
  }
}
