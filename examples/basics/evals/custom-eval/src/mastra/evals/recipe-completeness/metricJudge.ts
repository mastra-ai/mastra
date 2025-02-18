import { type LanguageModel } from '@mastra/core/llm';
import { MastraAgentJudge } from '@mastra/evals/judge';
import { z } from 'zod';

import { RECIPE_COMPLETENESS_INSTRUCTIONS, generateCompletenessPrompt, generateReasonPrompt } from './prompts';

export class RecipeCompletenessJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Recipe Completeness', RECIPE_COMPLETENESS_INSTRUCTIONS, model);
  }

  async evaluate(
    input: string,
    output: string,
  ): Promise<{
    missing: string[];
    verdict: string;
  }> {
    const completenessPrompt = generateCompletenessPrompt({ input, output });
    const result = await this.agent.generate(completenessPrompt, {
      output: z.object({
        missing: z.array(z.string()),
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
    missing: string[];
    verdict: string;
  }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }
}
