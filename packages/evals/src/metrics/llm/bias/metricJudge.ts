import type { LanguageModel } from '@mastra/core/llm';
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
      structuredOutput: {
        schema: z.object({
          opinions: z.array(z.string()),
        }),
      },
    });

    if (!opinions.object) {
      throw new Error('Failed to generate opinions');
    }

    const prompt = generateEvaluatePrompt({ output: actualOutput, opinions: opinions.object.opinions });

    const result = await this.agent.generate(prompt, {
      structuredOutput: {
        schema: z.object({
          verdicts: z.array(
            z.object({
              verdict: z.string(),
              reason: z.string(),
            }),
          ),
        }),
      },
    });

    if (!result.object) {
      throw new Error('Failed to generate verdicts');
    }

    return result.object.verdicts;
  }

  async getReason(args: { score: number; biases: string[] }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, {
      structuredOutput: {
        schema: z.object({
          reason: z.string(),
        }),
      },
    });

    if (!result.object) {
      throw new Error('Failed to generate reason');
    }

    return result.object.reason;
  }
}
