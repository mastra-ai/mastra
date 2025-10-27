import type { LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import {
  generateEvaluatePrompt,
  ANSWER_RELEVANCY_AGENT_INSTRUCTIONS,
  generateEvaluationStatementsPrompt,
  generateReasonPrompt,
} from './prompts';

export class AnswerRelevancyJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Answer Relevancy', ANSWER_RELEVANCY_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(input: string, actualOutput: string): Promise<{ verdict: string; reason: string }[]> {
    const statementPrompt = generateEvaluationStatementsPrompt({ output: actualOutput });
    const statements = await this.agent.generate(statementPrompt, {
      structuredOutput: {
        schema: z.object({
          statements: z.array(z.string()),
        }),
      },
    });
    if (!statements.object) {
      throw new Error('Failed to generate evaluation statements');
    }
    const prompt = generateEvaluatePrompt({ input, statements: statements.object.statements });
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
    verdicts: { verdict: string; reason: string }[];
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
