import { z } from 'zod';

import { Agent } from '../agent';
import { MastraError } from '../error';
import { MastraScorer } from './base';
import type {
  PreprocessStepFn,
  ReasonStepFn,
  ScoringInput,
  ScoringInputWithPreprocessStepResult,
  ScoringInputWithPreprocessStepResultAndAnalyzeStepResult,
  ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore,
  ScoringResult,
  TypedScorerOptions,
} from './types';
import { isAnalyzeConfig, isGenerateScoreConfig, isPreprocessConfig, isReasonConfig } from './utils';

// Enhanced type inference with conditional prompt fields
export function createScorer<
  TPreprocessOutput = any,
  TAnalyzeOutput = any,
  TOptions extends TypedScorerOptions<TPreprocessOutput, TAnalyzeOutput> = TypedScorerOptions<
    TPreprocessOutput,
    TAnalyzeOutput
  >,
>(
  opts: TOptions,
): MastraScorer<
  ScoringResult<
    TOptions['preprocess'],
    TOptions['analyze'],
    TOptions['generateReason'],
    TPreprocessOutput,
    TAnalyzeOutput
  >
> {
  // Default judge for LLM steps
  const defaultJudge = opts.judge;

  return new MastraScorer({
    name: opts.name,
    description: opts.description,
    metadata: opts,

    // Preprocess step (optional)
    ...(opts.preprocess && {
      preprocess: async ({ run }: { run: ScoringInput }) => {
        if (isPreprocessConfig(opts.preprocess!)) {
          const config = opts.preprocess;
          const judge = config.judge || defaultJudge;

          if (!judge) {
            throw new MastraError({
              id: 'PREPROCESS_STEP_NO_JUDGE_PROVIDED',
              domain: 'SCORER',
              category: 'USER',
              text: 'No judge provided for preprocess step when using LLM to preprocess the input.',
              details: {
                name: opts.name,
              },
            });
          }

          const llm = new Agent({
            name: `${opts.name}-preprocess`,
            instructions: judge.instructions,
            model: judge.model,
          });

          const prompt = config.createPrompt({ run });
          const result = await llm.generate(prompt, {
            output: config.outputSchema || z.record(z.any()),
          });

          return {
            result: result.object as TPreprocessOutput,
            prompt,
          };
        } else {
          // Function-based preprocessing
          const result = (opts.preprocess as PreprocessStepFn<TPreprocessOutput>)({ run });
          const finalResult = result instanceof Promise ? await result : result;
          return {
            result: finalResult as TPreprocessOutput,
          };
        }
      },
    }),

    // Analyze step (now optional)
    ...(opts.analyze && {
      analyze: async ({ run }: { run: ScoringInputWithPreprocessStepResult<TPreprocessOutput> }) => {
        if (isAnalyzeConfig(opts.analyze!)) {
          const config = opts.analyze;
          const judge = config.judge || defaultJudge;

          if (!judge) {
            throw new MastraError({
              id: 'ANALYZE_STEP_NO_JUDGE_PROVIDED',
              domain: 'SCORER',
              category: 'USER',
              text: 'No judge provided for analyze step when using LLM to analyze the input.',
              details: {
                name: opts.name,
              },
            });
          }

          const llm = new Agent({
            name: `${opts.name}-analyze`,
            instructions: judge.instructions,
            model: judge.model,
          });

          const prompt = config.createPrompt({ run });
          const result = await llm.generate(prompt, {
            output: config.outputSchema || z.record(z.any()),
          });

          return {
            result: result.object as TAnalyzeOutput,
            prompt,
          };
        } else {
          // Function-based analysis - wrap result automatically
          const result = opts.analyze!({ run });
          const finalResult = result instanceof Promise ? await result : result;
          return {
            result: finalResult,
          };
        }
      },
    }),

    // Generate Score step (required) - separate from analysis
    generateScore: async ({
      run,
    }: {
      run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResult<TPreprocessOutput, TAnalyzeOutput>;
    }) => {
      // TODO Confirm this is correct way to generate score for LLM scorer
      if (isGenerateScoreConfig(opts.generateScore)) {
        const config = opts.generateScore;
        const judge = config.judge || defaultJudge;

        if (!judge) {
          throw new MastraError({
            id: 'GENERATE_SCORE_STEP_NO_JUDGE_PROVIDED',
            domain: 'SCORER',
            category: 'USER',
            text: 'No judge provided for generate score step when using LLM to generate the score.',
            details: {
              name: opts.name,
            },
          });
        }

        const llm = new Agent({
          name: `${opts.name}-score`,
          instructions: judge.instructions,
          model: judge.model,
        });

        const prompt = config.createPrompt({ run });
        const result = await llm.generate(prompt, {
          output: config.outputSchema || z.number(),
        });

        return typeof result.object === 'number' ? result.object : (result.object as any).score || 0;
      } else {
        // Function-based scoring
        const scoreResult = opts.generateScore({ run });
        const finalScoreResult = scoreResult instanceof Promise ? await scoreResult : scoreResult;
        return typeof finalScoreResult === 'number' ? finalScoreResult : await finalScoreResult;
      }
    },

    // Reason step (optional)
    reason: opts.generateReason
      ? async ({
          run,
        }: {
          run: ScoringInputWithPreprocessStepResultAndAnalyzeStepResultAndScore<TPreprocessOutput, TAnalyzeOutput>;
        }) => {
          if (isReasonConfig(opts.generateReason!)) {
            const config = opts.generateReason;
            const judge = config.judge || defaultJudge;

            if (!judge) {
              throw new MastraError({
                id: 'REASON_STEP_NO_JUDGE_PROVIDED',
                domain: 'SCORER',
                category: 'USER',
                text: 'No judge provided for reason step when using LLM to generate the reason.',
                details: {
                  name: opts.name,
                },
              });
            }
            const llm = new Agent({
              name: `${opts.name}-reason`,
              instructions: judge.instructions,
              model: judge.model,
            });

            const prompt = config.createPrompt({ run });
            const result = await llm.generate(prompt, {
              output: z.object({
                reason: z.string(),
              }),
            });

            return {
              reason: result.object.reason,
              prompt,
            };
          } else {
            // Function-based reasoning - wrap result automatically
            const reasonText = (opts.generateReason as ReasonStepFn<TPreprocessOutput, TAnalyzeOutput>)({ run });
            const finalReasonText = reasonText instanceof Promise ? await reasonText : reasonText;
            return finalReasonText ? { reason: finalReasonText } : null;
          }
        }
      : undefined,
  });
}
