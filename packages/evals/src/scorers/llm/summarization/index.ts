import { compileSchema } from '@internal/types-builder/compile-zod';
import { createScorer } from '@mastra/core/evals';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod/v4';
import {
  extractAgentResponseMessages,
  getAssistantMessageFromRunOutput,
  getUserMessageFromRunInput,
  isScorerRunInputForAgent,
  isScorerRunOutputForAgent,
  roundToTwoDecimals,
} from '../../utils';
import type { ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge } from '../../utils';
import {
  createCoveragePrompt,
  createSourceJudgementPrompt,
  createSummarizationReasonPrompt,
  SUMMARIZATION_AGENT_INSTRUCTIONS,
} from './prompts';

export interface SummarizationMetricOptions {
  scale?: number;
  /** Text the summary is judged against. Defaults to the user message of the run input. */
  source?: string;
  sourceExtractor?: (input: ScorerRunInputForAgent, output: ScorerRunOutputForAgent) => string;
  /** Upper bound on the coverage questions drawn from the source. Defaults to 10. */
  maxQuestions?: number;
}

const DEFAULT_MAX_QUESTIONS = 10;

const sourceJudgementOutputSchema = compileSchema(
  z.object({
    alignment: z.array(
      z.object({
        claim: z.string(),
        supported: z.boolean(),
        reason: z.string(),
      }),
    ),
    questions: z.array(z.string()),
  }),
);

const coverageOutputSchema = compileSchema(
  z.object({
    coverage: z.array(
      z.object({
        question: z.string(),
        answered: z.boolean(),
        reason: z.string(),
      }),
    ),
  }),
);

/**
 * Resolves the text a summary is judged against.
 *
 * Prefers `sourceExtractor` when the run is agent-shaped, then the static `source`
 * option, and falls back to the user message of the run input.
 *
 * @returns The source text, or an empty string when none can be resolved
 */
const getSourceText = ({
  input,
  output,
  options,
}: {
  input?: ScorerRunInputForLLMJudge;
  output: ScorerRunOutputForLLMJudge;
  options: SummarizationMetricOptions;
}) => {
  if (options.sourceExtractor && isScorerRunInputForAgent(input) && isScorerRunOutputForAgent(output)) {
    return options.sourceExtractor(input, output);
  }

  return options.source ?? getUserMessageFromRunInput(input) ?? '';
};

/**
 * Resolves the summary being judged.
 *
 * The summary is the agent's last assistant message that carries text. Taking
 * the first one would pick up a tool-call turn with no text of its own, which
 * an agent that fetches the document before summarizing it always produces.
 *
 * @returns The summary text, or an empty string when the output carries none
 */
const getSummary = (output: ScorerRunOutputForLLMJudge) => {
  if (isScorerRunOutputForAgent(output)) {
    const responses = extractAgentResponseMessages(output).filter(response => response.trim().length > 0);
    if (responses.length > 0) {
      return responses[responses.length - 1] as string;
    }
  }

  return getAssistantMessageFromRunOutput(output) ?? '';
};

/**
 * Divides matched items by total items, guarding against an empty denominator.
 *
 * @param matched - Number of items that met the criterion
 * @param total - Number of items judged
 * @returns A value between 0 and 1, and 0 when nothing was judged
 */
const ratio = (matched: number, total: number) => (total === 0 ? 0 : Math.min(1, matched / total));

/** A judgement on whether one summary claim is supported by the source text. */
interface AlignmentVerdict {
  claim: string;
  supported: boolean;
  reason: string;
}

/** A judgement on whether one source question can be answered from the summary. */
interface CoverageVerdict {
  question: string;
  answered: boolean;
  reason: string;
}

/**
 * Turns the judge verdicts into the two axes the score is built from.
 *
 * Coverage is measured against the questions that were asked, not against the
 * verdicts that came back, so a judge that answers only some of them cannot
 * raise the score by staying silent. A question with no verdict at all counts
 * as missing, and extra verdicts are dropped.
 *
 * @returns Both axis ratios, the claims and questions behind them, and whether
 * there was anything to score at all
 */
const measureAxes = ({
  questions = [],
  alignment = [],
  coverage = [],
  maxQuestions,
}: {
  questions?: string[];
  alignment?: AlignmentVerdict[];
  coverage?: CoverageVerdict[];
  maxQuestions: number;
}) => {
  const totalQuestions = Math.min(questions.length, maxQuestions);
  const judgedQuestions = questions.slice(0, totalQuestions);
  const judgedCoverage = coverage.slice(0, totalQuestions);

  return {
    alignmentScore: ratio(alignment.filter(verdict => verdict.supported).length, alignment.length),
    coverageScore: ratio(judgedCoverage.filter(verdict => verdict.answered).length, totalQuestions),
    unsupportedClaims: alignment.filter(verdict => !verdict.supported).map(verdict => verdict.claim),
    missingQuestions: judgedQuestions.filter((_, index) => !judgedCoverage[index]?.answered),
    isScorable: alignment.length > 0 && totalQuestions > 0,
  };
};

/**
 * Creates a scorer that evaluates a summary against the text it condenses.
 *
 * The scorer judges two axes and returns the lower one, so a summary cannot pass
 * by being faithful but empty, or thorough but wrong:
 * - Alignment: supported claims / total claims
 * - Coverage: answered questions / total questions
 *
 * Coverage is judged in a separate call that never receives the source text, so
 * the judge cannot answer a question from information the summary left out.
 *
 * @param model - Language model used as the judge
 * @param options - Source resolution, question cap, and score scaling
 * @returns A scorer producing `min(alignment, coverage) × scale`
 * @throws When `maxQuestions` is below 1
 *
 * @example
 * ```ts
 * const scorer = createSummarizationScorer({
 *   model: 'openai/gpt-5.5',
 *   options: { maxQuestions: 10 },
 * });
 *
 * const result = await scorer.run(run);
 * ```
 */
export function createSummarizationScorer({
  model,
  options = {},
}: {
  model: MastraModelConfig;
  options?: SummarizationMetricOptions;
}) {
  if (options.maxQuestions !== undefined && options.maxQuestions < 1) {
    throw new Error('maxQuestions must be at least 1 for Summarization scoring');
  }

  const maxQuestions = options.maxQuestions ?? DEFAULT_MAX_QUESTIONS;

  return createScorer<ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge>({
    id: 'summarization-scorer',
    name: 'Summarization Scorer',
    description:
      'A scorer that evaluates whether a summary stays faithful to its source text and preserves the information the source states',
    judge: {
      model,
      instructions: SUMMARIZATION_AGENT_INSTRUCTIONS,
    },
    type: 'agent',
  })
    .preprocess({
      description: 'Judge each summary claim against the source and draw coverage questions from it',
      outputSchema: sourceJudgementOutputSchema,
      /** Builds the source-judgement prompt from the run's source text and summary. */
      createPrompt: ({ run }) =>
        createSourceJudgementPrompt({
          sourceText: getSourceText({ input: run.input, output: run.output, options }),
          summary: getSummary(run.output),
          maxQuestions,
        }),
    })
    .analyze({
      description: 'Answer the coverage questions using only the summary',
      outputSchema: coverageOutputSchema,
      /** Builds the coverage prompt from the summary and the questions drawn earlier. */
      createPrompt: ({ results, run }) =>
        createCoveragePrompt({
          summary: getSummary(run.output),
          questions: (results.preprocessStepResult?.questions ?? []).slice(0, maxQuestions),
        }),
    })
    .generateScore(({ results }) => {
      const axes = measureAxes({
        questions: results.preprocessStepResult?.questions,
        alignment: results.preprocessStepResult?.alignment,
        coverage: results.analyzeStepResult?.coverage,
        maxQuestions,
      });

      if (!axes.isScorable) {
        return 0;
      }

      return roundToTwoDecimals(Math.min(axes.alignmentScore, axes.coverageScore) * (options.scale ?? 1));
    })
    .generateReason({
      description: 'Explain which axis produced the summarization score',
      /** Builds the explanation prompt from the finished score and both axes. */
      createPrompt: ({ results, run, score }) => {
        const axes = measureAxes({
          questions: results.preprocessStepResult?.questions,
          alignment: results.preprocessStepResult?.alignment,
          coverage: results.analyzeStepResult?.coverage,
          maxQuestions,
        });

        return createSummarizationReasonPrompt({
          sourceText: getSourceText({ input: run.input, output: run.output, options }),
          summary: getSummary(run.output),
          score,
          scale: options.scale ?? 1,
          alignmentScore: roundToTwoDecimals(axes.alignmentScore),
          coverageScore: roundToTwoDecimals(axes.coverageScore),
          unsupportedClaims: axes.unsupportedClaims,
          missingQuestions: axes.missingQuestions,
        });
      },
    });
}
