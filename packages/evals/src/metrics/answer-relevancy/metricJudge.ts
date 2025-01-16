import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import {
  generateEvaluatePrompt,
  generateReasonPrompt,
  ANSWER_RELEVANCY_AGENT_INSTRUCTIONS,
  generateEvaluationStatementsPrompt,
} from './prompts';

export class AnswerRelevancyJudge extends MastraAgentJudge {
  constructor(provider: string, name: string) {
    super(provider, name, ANSWER_RELEVANCY_AGENT_INSTRUCTIONS, 'Answer Relevancy');
  }

  async evaluate(input: string, actualOutput: string): Promise<{ verdict: string; reason: string }[]> {
    const statementPrompt = generateEvaluationStatementsPrompt({ output: actualOutput });
    const statements = await this.agent.generate(statementPrompt, {
      output: z.object({
        statements: z.array(z.string()),
      }),
    });
    const prompt = generateEvaluatePrompt({ input, statements: statements.object.statements });
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

  async getReason(input: string, actualOutput: string, score: number, reasons: string[]): Promise<string> {
    const prompt = generateReasonPrompt({ input, output: actualOutput, reasons, score });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });
    return result.object.reason;
  }
}
