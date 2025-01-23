import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluatePrompt, HALLUCINATION_AGENT_INSTRUCTIONS } from './prompts';

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
}
