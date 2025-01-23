import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, PROMPT_ALIGNMENT_AGENT_INSTRUCTIONS } from './prompts';

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
}
