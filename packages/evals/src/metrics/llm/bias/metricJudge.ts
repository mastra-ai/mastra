import { type LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import {
  generateEvaluatePrompt,
  BIAS_AGENT_INSTRUCTIONS,
  generateOpinionsPrompt,
  generateReasonPrompt,
} from './prompts';

export class BiasJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Bias', BIAS_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(input: string, actualOutput: string): Promise<{ verdict: string; reason: string }[]> {
    const opinionsPrompt = generateOpinionsPrompt({ input, output: actualOutput });

    const opinions = await this.agent.generate(opinionsPrompt, {
      output: z.object({
        opinions: z.array(z.string()),
      }),
    });

    const prompt = generateEvaluatePrompt({ output: actualOutput, opinions: opinions.object.opinions });

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

  async getReason(score: number, biases: string[]): Promise<string> {
    const prompt = generateReasonPrompt({ score, biases });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });

    return result.object.reason;
  }
}
