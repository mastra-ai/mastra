import { type LanguageModel } from '@mastra/core/llm';
import { MastraAgentJudge } from '@mastra/evals/judge';
import { z } from 'zod';

import { GLUTEN_INSTRUCTIONS, generateGlutenPrompt, generateReasonPrompt } from './prompts';

export class GlutenCheckerJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Gluten Checker', GLUTEN_INSTRUCTIONS, model);
  }

  async evaluate(output: string): Promise<{
    isGlutenFree: boolean;
    glutenSources: string[];
  }> {
    const glutenPrompt = generateGlutenPrompt({ output });
    const result = await this.agent.generate(glutenPrompt, {
      output: z.object({
        isGlutenFree: z.boolean(),
        glutenSources: z.array(z.string()),
      }),
    });

    return result.object;
  }

  async getReason(args: { isGlutenFree: boolean; glutenSources: string[] }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }
}
