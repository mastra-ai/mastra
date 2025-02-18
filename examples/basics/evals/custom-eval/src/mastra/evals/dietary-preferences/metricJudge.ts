import { type LanguageModel } from '@mastra/core/llm';
import { MastraAgentJudge } from '@mastra/evals/judge';
import { z } from 'zod';

import { DIETARY_AGENT_INSTRUCTIONS, generateDietaryPreferencesPrompt, generateReasonPrompt } from './prompts';

export class DietaryPreferencesJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Dietary Preferences', DIETARY_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(
    input: string,
    output: string,
  ): Promise<{
    ingredients: string[];
    verdict: string;
  }> {
    const dietaryPreferencesPrompt = generateDietaryPreferencesPrompt({ input, output });
    // @ts-ignore
    const result = await this.agent.generate(dietaryPreferencesPrompt, {
      output: z.object({
        ingredients: z.array(z.string()),
        verdict: z.string(),
      }),
    });

    return result.object;
  }

  async getReason(args: {
    input: string;
    output: string;
    score: number;
    scale: number;
    ingredients: string[];
    verdict: string;
  }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    // @ts-ignore
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }
}
