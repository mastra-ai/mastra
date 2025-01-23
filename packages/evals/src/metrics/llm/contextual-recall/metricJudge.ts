import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { CONTEXT_POSITION_AGENT_INSTRUCTIONS, generateEvaluatePrompt } from './prompts';

export class ContextualRecallJudge extends MastraAgentJudge {
  constructor(model: ModelConfig) {
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
