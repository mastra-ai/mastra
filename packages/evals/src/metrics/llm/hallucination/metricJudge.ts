import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, generateReasonPrompt, HALLUCINATION_AGENT_INSTRUCTIONS } from './prompts';

export class HallucinationJudge extends MastraAgentJudge {
  constructor(model: ModelConfig) {
    super('Hallucination', HALLUCINATION_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(output: string, context: string[]): Promise<{ statement: string; verdict: string; reason: string }[]> {
    const evaluatePrompt = generateEvaluatePrompt({ context, output });
    const result = await this.agent.generate(evaluatePrompt, {
      output: z.object({
        verdicts: z.array(
          z.object({
            statement: z.string(),
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
    output: string,
    context: string[],
    score: number,
    scale: number,
    verdicts: { verdict: string; reason: string }[],
  ): Promise<string> {
    const prompt = generateReasonPrompt({ input, output, context, score, scale, verdicts });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });
    return result.object.reason;
  }
}
