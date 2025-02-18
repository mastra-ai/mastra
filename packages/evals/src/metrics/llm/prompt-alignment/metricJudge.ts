import type { LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS, generateReasonPrompt } from './prompts';

export class PromptAlignmentJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
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

  async getReason(args: {
    input: string;
    output: string;
    score: number;
    verdicts: { verdict: string; reason: string }[];
    scale: number;
  }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, { output: z.object({ reason: z.string() }) });
    return result.object.reason;
  }
}
