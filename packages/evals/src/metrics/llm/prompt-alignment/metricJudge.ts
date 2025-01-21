import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, generateReasonPrompt, PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS } from './prompts';

export class PromptAlignmentJudge extends MastraAgentJudge {
  constructor(model: ModelConfig) {
    super('Prompt Alignment', PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(
    input: string,
    actualOutput: string,
    instructions: string[],
  ): Promise<{ verdict: string; reason: string }[]> {
    const prompt = generateEvaluatePrompt({ input, output: actualOutput, instructions });
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
    reasons: string[],
  ): Promise<string> {
    const prompt = generateReasonPrompt({ input, output: actualOutput, reasons, score, scale });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });
    return result.object.reason;
  }
}
