import type { LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { CONTEXT_PRECISION_AGENT_INSTRUCTIONS, generateEvaluatePrompt, generateReasonPrompt } from './prompts';

export class ContextPrecisionJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Context Precision', CONTEXT_PRECISION_AGENT_INSTRUCTIONS, model);
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

  async getReason(
    input: string,
    actualOutput: string,
    score: number,
    scale: number,
    verdicts: {
      verdict: string;
      reason: string;
    }[],
  ): Promise<string> {
    const prompt = generateReasonPrompt({ input, output: actualOutput, verdicts, score, scale });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });
    return result.object.reason;
  }
}
