import { type LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { CONTEXT_RELEVANCY_AGENT_INSTRUCTIONS, generateEvaluatePrompt, generateReasonPrompt } from './prompts';

export class ContextRelevancyJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Context Relevancy', CONTEXT_RELEVANCY_AGENT_INSTRUCTIONS, model);
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

  async getReason(args: {
    score: number;
    input: string;
    irrelevancies: string[];
    relevantStatements: string[];
  }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });
    return result.object.reason;
  }
}
