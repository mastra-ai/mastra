import type { LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { CONTEXT_POSITION_AGENT_INSTRUCTIONS, generateEvaluatePrompt, generateReasonPrompt } from './prompts';

export class ContextPositionJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Context Position', CONTEXT_POSITION_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(
    input: string,
    actualOutput: string,
    retrievalContext: string[],
  ): Promise<{ verdict: string; reason: string }[]> {
    const prompt = generateEvaluatePrompt({
      input,
      output: actualOutput,
      context: retrievalContext,
    });
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

  async getReason(args: {
    input: string;
    output: string;
    score: number;
    scale: number;
    verdicts: {
      verdict: string;
      reason: string;
    }[];
  }): Promise<string> {
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
