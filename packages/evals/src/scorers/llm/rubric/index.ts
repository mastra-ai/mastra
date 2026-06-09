import { compileSchema } from '@internal/types-builder/compile-zod';
import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';
import { z } from 'zod/v4';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import type { ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge } from '../../utils';
import { RUBRIC_INSTRUCTIONS, createAnalyzePrompt, formatRubricReason } from './prompts';
import type { RubricAnalysisResult, RubricCriterionInput } from './prompts';

/**
 * A single rubric criterion the agent's output is graded against.
 */
export interface RubricCriterion {
  /** Optional stable identifier for the criterion. */
  id?: string;
  /** What the output must satisfy, e.g. "All tests pass" or "Includes a recommendations section". */
  description: string;
  /**
   * Whether this criterion must be satisfied for the task to be considered complete.
   * Defaults to `true`. Optional criteria are graded and reported but do not gate completion.
   */
  required?: boolean;
}

/**
 * Rubric input accepted by the scorer factory and by the dynamic `rubric` context value.
 * A string is treated as a newline-delimited checklist; leading list markers ("-", "*", "1.")
 * are stripped. Every parsed line becomes a required criterion.
 */
export type RubricInput = RubricCriterion[] | string;

export interface RubricScorerOptions {
  /** Scale applied to the final score. Defaults to 1. Only relevant for standalone evals — `isTaskComplete` gates on `=== 1`. */
  scale?: number;
}

const analyzeOutputSchema = compileSchema(
  z.object({
    criteria: z.array(
      z.object({
        criterion: z.string(),
        satisfied: z.boolean(),
        required: z.boolean(),
        reasoning: z.string(),
      }),
    ),
    overallAssessment: z.string(),
  }),
);

/**
 * Parse a string rubric into criteria. Each non-empty line becomes a required criterion,
 * with common list markers stripped from the front.
 */
function parseRubricString(rubric: string): RubricCriterion[] {
  return rubric
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(line => line.length > 0)
    .map(description => ({ description, required: true }));
}

function normalizeRubric(rubric: RubricInput | undefined): RubricCriterion[] {
  if (!rubric) return [];
  if (typeof rubric === 'string') return parseRubricString(rubric);
  return rubric;
}

/**
 * Resolve the rubric for a run: prefer the rubric passed to the factory, otherwise look for a
 * dynamic `rubric` value on the run's request context, additional context, or input. This lets a
 * single scorer instance grade different rubrics per run (e.g. when passed at `stream()` time via
 * request context) without rebuilding the scorer.
 */
function resolveRubric({
  staticRubric,
  run,
}: {
  staticRubric: RubricCriterion[];
  run: { input?: unknown; requestContext?: unknown; additionalContext?: unknown };
}): RubricCriterion[] {
  if (staticRubric.length > 0) return staticRubric;

  const dynamic =
    pickRubric(run.requestContext) ?? pickRubric(run.additionalContext) ?? pickRubric(run.input);

  return normalizeRubric(dynamic);
}

/**
 * Read a `rubric` value from a source that may be a plain object, a Map-like / RequestContext
 * instance (with a `.get` method), or undefined.
 */
function pickRubric(source: unknown): RubricInput | undefined {
  if (!source || typeof source !== 'object') return undefined;

  let value: unknown;
  const getter = (source as { get?: unknown }).get;
  if (typeof getter === 'function') {
    value = (getter as (key: string) => unknown).call(source, 'rubric');
  } else {
    value = (source as Record<string, unknown>).rubric;
  }

  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value as RubricCriterion[];
  return undefined;
}

function toCriterionInputs(criteria: RubricCriterion[]): RubricCriterionInput[] {
  return criteria.map(c => ({ criterion: c.description, required: c.required !== false }));
}

function getOutputText(run: { output?: unknown; input?: unknown }): string {
  const fromOutput = getAssistantMessageFromRunOutput(run.output as ScorerRunOutputForLLMJudge);
  if (fromOutput) return fromOutput;

  // `isTaskComplete` passes the in-progress text on `run.input.currentText`.
  if (run.input && typeof run.input === 'object' && typeof (run.input as Record<string, unknown>).currentText === 'string') {
    return (run.input as Record<string, unknown>).currentText as string;
  }

  return typeof run.output === 'string' ? run.output : '';
}

function getTaskText(run: { input?: unknown }): string {
  // `isTaskComplete` passes the original task on `run.input.originalTask`.
  if (run.input && typeof run.input === 'object' && typeof (run.input as Record<string, unknown>).originalTask === 'string') {
    return (run.input as Record<string, unknown>).originalTask as string;
  }
  return getUserMessageFromRunInput(run.input as ScorerRunInputForLLMJudge) ?? '';
}

/**
 * Creates an LLM-as-judge scorer that grades an agent's output against a rubric and returns a
 * **binary** score: `1` only when every required criterion is satisfied, otherwise `0`. The
 * `generateReason` output lists each unmet criterion with the judge's reasoning.
 *
 * It is designed to drop into `isTaskComplete`, which treats `score === 1` as "task complete" and
 * injects the reason back into the conversation as feedback, so the agent iterates until the rubric
 * is satisfied (or `maxSteps` is reached):
 *
 * @example
 * ```typescript
 * import { createRubricScorer } from '@mastra/evals/scorers/prebuilt';
 *
 * const rubricScorer = createRubricScorer({
 *   model: '__GATEWAY_OPENAI_MODEL_MINI__',
 *   criteria: [
 *     { description: 'The response includes an analysis section' },
 *     { description: 'The response includes concrete recommendations' },
 *   ],
 * });
 *
 * await supervisor.stream('Research AI in education', {
 *   maxSteps: 10,
 *   isTaskComplete: { scorers: [rubricScorer], strategy: 'all' },
 * });
 * ```
 *
 * The rubric can also be supplied dynamically per run via request/additional context under the
 * `rubric` key (string checklist or `RubricCriterion[]`). If no rubric resolves, the scorer is a
 * no-op and returns `1` (so it does not gate the loop), mirroring "if the rubric is absent, do nothing".
 */
export function createRubricScorer({
  model,
  criteria,
  options,
}: {
  model: MastraModelConfig;
  criteria?: RubricInput;
  options?: RubricScorerOptions;
}) {
  const scale = options?.scale ?? 1;
  const staticRubric = normalizeRubric(criteria);

  return createScorer<ScorerRunInputForLLMJudge, ScorerRunOutputForLLMJudge>({
    id: 'rubric-scorer',
    name: 'Rubric (LLM)',
    description: 'Grades an agent output against a rubric of criteria, returning 1 only when every required criterion is satisfied',
    judge: {
      model,
      instructions: RUBRIC_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Judge the output against each rubric criterion',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const rubric = resolveRubric({ staticRubric, run });

        // No rubric to grade against — emit an empty analysis. generateScore turns this into a
        // passing no-op so the scorer does not gate the loop.
        if (rubric.length === 0) {
          return `No rubric was provided. Return exactly: {"criteria": [], "overallAssessment": "No rubric provided; nothing to grade."}`;
        }

        return createAnalyzePrompt({
          originalTask: getTaskText(run),
          output: getOutputText(run),
          criteria: toCriterionInputs(rubric),
        });
      },
    })
    .generateScore(({ results }) => {
      const analysis = results.analyzeStepResult as RubricAnalysisResult | undefined;

      // No analysis or empty rubric → no-op pass.
      if (!analysis || analysis.criteria.length === 0) {
        return 1 * scale;
      }

      const requiredCriteria = analysis.criteria.filter(c => c.required);

      // If somehow nothing is marked required, treat all criteria as required.
      const gating = requiredCriteria.length > 0 ? requiredCriteria : analysis.criteria;
      const allSatisfied = gating.every(c => c.satisfied);

      return (allSatisfied ? 1 : 0) * scale;
    })
    .generateReason(({ results, score }) => {
      const analysis = results.analyzeStepResult as RubricAnalysisResult | undefined;

      if (!analysis || analysis.criteria.length === 0) {
        return 'No rubric was provided, so the rubric check passed by default.';
      }

      return formatRubricReason({ score, analysis });
    });
}
