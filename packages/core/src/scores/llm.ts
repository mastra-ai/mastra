import { z } from 'zod';
import { Agent } from '../agent';
import type { MastraLanguageModel } from '../agent/types';
import { MastraScorer } from './base';
import type {
  ScoringInput,
  ScoringInputWithExtractStepResult,
  ScoringInputWithExtractStepResultAndAnalyzeStepResult,
} from './types';

type LLMJudge = {
  model: MastraLanguageModel;
  instructions: string;
};

export type LLMScorerOptions<TExtractOutput extends Record<string, any> = any, TScoreOutput = any> = {
  name: string;
  description: string;
  judge: LLMJudge;
  extract?: {
    description: string;
    judge?: LLMJudge;
    outputSchema: z.ZodType<TExtractOutput>;
    createPrompt: ({ run }: { run: ScoringInput }) => string;
  };
  analyze: {
    description: string;
    judge?: LLMJudge;
    outputSchema: z.ZodType<TScoreOutput>;
    createPrompt: ({ run }: { run: ScoringInput & { extractStepResult: TExtractOutput } }) => string;
  };
  reason?: {
    description: string;
    judge?: LLMJudge;
    createPrompt: ({
      run,
    }: {
      run: ScoringInputWithExtractStepResult & { analyzeStepResult: TScoreOutput; score: number };
    }) => string;
  };
  calculateScore: ({ run }: { run: ScoringInputWithExtractStepResult & { analyzeStepResult: TScoreOutput } }) => number;
};

export function createLLMScorer<TExtractOutput extends Record<string, any> = any, TScoreOutput = any>(
  opts: LLMScorerOptions<TExtractOutput, TScoreOutput>,
) {
  const model = opts.judge.model;

  const llm = new Agent({
    name: opts.name,
    instructions: opts.judge.instructions,
    model: model,
  });

  const scorer = new MastraScorer({
    name: opts.name,
    description: opts.description,
    metadata: opts,
    isLLMScorer: true,
    ...(opts.extract && {
      extract: async run => {
        const prompt = opts.extract!.createPrompt({ run });
        const extractResult = await llm.generate(prompt, {
          output: opts.extract!.outputSchema,
        });

        return {
          result: extractResult.object as Record<string, any>,
          prompt,
        };
      },
    }),
    analyze: async run => {
      const runWithExtractResult = {
        ...run,
        extractStepResult: run.extractStepResult,
      };

      const prompt = opts.analyze.createPrompt({ run: runWithExtractResult });

      const analyzeResult = await llm.generate(prompt, {
        output: opts.analyze.outputSchema,
      });

      let score = 0;

      const runWithScoreResult = {
        ...runWithExtractResult,
        analyzeStepResult: analyzeResult.object,
      };

      if (opts.calculateScore) {
        score = opts.calculateScore({ run: runWithScoreResult });
      }

      (runWithScoreResult as ScoringInputWithExtractStepResultAndAnalyzeStepResult).score = score;

      return {
        result: analyzeResult.object!,
        score: score,
        prompt,
      };
    },
    reason: opts.reason
      ? async run => {
          // Prepare run with both extract and score results
          const runWithAllResults = {
            ...run,
            extractStepResult: run.extractStepResult,
            analyzeStepResult: run.analyzeStepResult, // Use results as fallback
            score: run.score || 0,
          };

          const prompt = opts.reason?.createPrompt({ run: runWithAllResults })!;

          const reasonResult = await llm.generate(prompt, {
            output: z.object({
              reason: z.string(),
            }),
          });

          return {
            reason: reasonResult.object.reason,
            reasonPrompt: prompt,
          };
        }
      : undefined,
  });

  return scorer;
}
