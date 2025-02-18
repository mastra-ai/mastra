import type { LanguageModel } from '@mastra/core/llm';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';
import { generateClaimExtractionPrompt } from '../faithfulness/prompts';

import {
  generateAlignmentPrompt,
  generateAnswersPrompt,
  generateQuestionsPrompt,
  generateReasonPrompt,
  SUMMARIZATION_AGENT_INSTRUCTIONS,
} from './prompts';

export class SummarizationJudge extends MastraAgentJudge {
  constructor(model: LanguageModel) {
    super('Summarization', SUMMARIZATION_AGENT_INSTRUCTIONS, model);
  }

  async evaluateAlignment(originalText: string, summary: string): Promise<{ verdict: string; reason: string }[]> {
    const claimsPrompt = generateClaimExtractionPrompt({ output: summary });
    const summaryClaims = await this.agent.generate(claimsPrompt, {
      output: z.object({
        claims: z.array(z.string()),
      }),
    });

    const prompt = generateAlignmentPrompt({ originalText, summaryClaims: summaryClaims.object.claims });
    const result = await this.agent.generate(prompt, {
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

  async evaluateQuestionBasedCoverage(
    originalText: string,
    summary: string,
  ): Promise<{
    questions: string[];
    answers: string[];
  }> {
    // Generate questions from original text
    const questionsPrompt = generateQuestionsPrompt({ originalText });
    const questionsResult = await this.agent.generate(questionsPrompt, {
      output: z.object({
        questions: z.array(z.string()),
      }),
    });

    // Check if summary can answer these questions
    const answersPrompt = generateAnswersPrompt({
      originalText,
      summary,
      questions: questionsResult.object.questions,
    });
    const answersResult = await this.agent.generate(answersPrompt, {
      output: z.object({
        answers: z.array(z.string()),
      }),
    });

    return {
      questions: questionsResult.object.questions,
      answers: answersResult.object.answers,
    };
  }

  async evaluateCoverage(originalText: string, summary: string): Promise<{ verdict: string; reason: string }[]> {
    const { questions, answers } = await this.evaluateQuestionBasedCoverage(originalText, summary);

    const coverageVerdicts = questions.map((question, index) => ({
      verdict: answers[index] as string,
      reason: question,
    }));

    return coverageVerdicts;
  }

  async getReason(args: {
    originalText: string;
    summary: string;
    alignmentScore: number;
    coverageScore: number;
    finalScore: number;
    alignmentVerdicts: { verdict: string; reason: string }[];
    coverageVerdicts: { verdict: string; reason: string }[];
    scale: number;
  }): Promise<string> {
    const prompt = generateReasonPrompt(args);
    const result = await this.agent.generate(prompt, { output: z.object({ reason: z.string() }) });
    return result.object.reason;
  }
}
