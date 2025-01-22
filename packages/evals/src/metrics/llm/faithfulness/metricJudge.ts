import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import {
  generateClaimExtractionPrompt,
  generateEvaluatePrompt,
  generateReasonPrompt,
  FAITHFULNESS_AGENT_INSTRUCTIONS,
} from './prompts';

export class FaithfulnessJudge extends MastraAgentJudge {
  constructor(model: ModelConfig) {
    super('Faithfulness', FAITHFULNESS_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(output: string, context: string[]): Promise<{ claim: string; verdict: string; reason: string }[]> {
    const claimsPrompt = generateClaimExtractionPrompt({ output });
    const claims = await this.agent.generate(claimsPrompt, {
      output: z.object({
        claims: z.array(z.string()),
      }),
    });

    if (claims.object.claims.length === 0) {
      return [];
    }

    const evaluatePrompt = generateEvaluatePrompt({ claims: claims.object.claims, context });
    const result = await this.agent.generate(evaluatePrompt, {
      output: z.object({
        verdicts: z.array(
          z.object({
            claim: z.string(),
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
