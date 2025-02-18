import type { LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, getReasonPrompt, TOXICITY_AGENT_INSTRUCTIONS } from './prompts';

export class ToxicityJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Toxicity', TOXICITY_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(input: string, actualOutput: string): Promise<{ verdict: string; reason: string }[]> {
    const prompt = generateEvaluatePrompt({ input, output: actualOutput });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        verdicts: z.array(
          z.object({
            verdict: z.string(),
            reason: z.string(),
          }),
        ),
      }),
    });

    return result.object.verdicts;
  }

  async getReason(args: { score: number; toxics: string[] }): Promise<string> {
    const prompt = getReasonPrompt(args);
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }
}
