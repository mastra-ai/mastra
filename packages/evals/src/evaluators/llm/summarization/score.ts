import type { Agent } from '@mastra/core/agent';
import type { EvaluatorSettings } from '@mastra/core/eval';
import { z } from 'zod';
import { roundToTwoDecimals } from '../../scoring/utils';
import { generateClaimExtractionPrompt } from '../faithfulness/prompts';
import type { LLMEvaluatorScorerArgs, Outcome } from '../types';
import { generateAlignmentPrompt, generateAnswersPrompt, generateQuestionsPrompt } from './prompts';

async function evaluateAlignment({ output, agent }: LLMEvaluatorScorerArgs) {
  const claimsPrompt = generateClaimExtractionPrompt({ output });

  const summaryClaims = await agent.generate(claimsPrompt, {
    output: z.object({
      claims: z.array(z.string()),
    }),
  });

  const prompt = generateAlignmentPrompt({ input: output, context: summaryClaims.object.claims });
  const result = await agent.generate(prompt, {
    output: z.object({
      outcomes: z.array(
        z.object({
          claim: z.string(),
          outcome: z.string(),
          reason: z.string(),
        }),
      ),
    }),
  });
  return result.object.outcomes;
}

async function evaluateQuestionBasedCoverage({
  input,
  output,
  agent,
}: {
  input: string;
  output: string;
  agent: Agent;
}): Promise<{
  questions: string[];
  answers: string[];
}> {
  // Generate questions from original text
  const questionsPrompt = generateQuestionsPrompt({ input });

  const questionsResult = await agent.generate(questionsPrompt, {
    output: z.object({
      questions: z.array(z.string()),
    }),
  });

  // Check if summary can answer these questions
  const answersPrompt = generateAnswersPrompt({
    input,
    output,
    questions: questionsResult.object.questions,
  });
  const answersResult = await agent.generate(answersPrompt, {
    output: z.object({
      answers: z.array(z.string()),
    }),
  });

  return {
    questions: questionsResult.object.questions,
    answers: answersResult.object.answers,
  };
}

async function evaluateCoverage({ input, output, agent }: LLMEvaluatorScorerArgs): Promise<Outcome[]> {
  const { questions, answers } = await evaluateQuestionBasedCoverage({ input, output, agent });

  const coverageOutcomes = questions.map((question, index) => ({
    outcome: answers[index] as string,
    reason: question,
    claim: question,
  }));

  return coverageOutcomes;
}

function calculateScore({ outcomes, settings }: { outcomes: Outcome[]; settings: EvaluatorSettings }): {
  score: number;
} {
  const numberOfOutcomes = outcomes?.length || 0;
  if (numberOfOutcomes === 0) {
    return { score: 0 };
  }

  let positiveCount = 0;
  for (const { outcome } of outcomes) {
    if (outcome.trim().toLowerCase() === 'yes') {
      positiveCount++;
    }
  }

  const score = positiveCount / numberOfOutcomes;

  return { score: roundToTwoDecimals(score * settings.scale) };
}

export async function score({ output, agent, ...rest }: LLMEvaluatorScorerArgs) {
  const alignmentOutcomes = await evaluateAlignment({ output, agent, ...rest });
  const coverageOutcomes = await evaluateCoverage({ output, agent, ...rest });

  const alignmentScore = calculateScore({ outcomes: alignmentOutcomes, settings: rest.settings });
  const coverageScore = calculateScore({ outcomes: coverageOutcomes, settings: rest.settings });
  const finalScore = Math.min(alignmentScore.score, coverageScore.score);

  return {
    score: finalScore,
    details: {
      alignmentScore: alignmentScore.score,
      coverageScore: coverageScore.score,
      alignmentOutcomes,
      coverageOutcomes,
    },
  };
}
