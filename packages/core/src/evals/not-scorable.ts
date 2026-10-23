import type { ScorerStepName } from './base';

/**
 * Brand for the value returned by `notScorable()`.
 *
 * `Symbol.for` keeps the brand stable across duplicate copies of
 * `@mastra/core` in one process, so a sentinel created by one copy is still
 * recognised by another.
 */
const NOT_SCORABLE: unique symbol = Symbol.for('mastra.evals.notScorable');

/**
 * Value returned from a scorer function step to declare that the run has
 * nothing for this scorer to evaluate. Create it with `notScorable()`.
 */
export interface NotScorable {
  readonly [NOT_SCORABLE]: true;
  /** Why the run is not scorable. */
  readonly reason?: string;
}

/**
 * How a not-scorable run surfaces on a `ScorerRunResult`.
 */
export interface NotScorableOutcome {
  /** The scorer step that returned `notScorable()`. */
  step: ScorerStepName;
  /** The reason passed to `notScorable()`, when one was given. */
  reason?: string;
}

/**
 * Declares that the current run has nothing for this scorer to evaluate.
 *
 * Return it from a scorer function step (typically `preprocess`). The
 * remaining steps are skipped, so no judge model call is spent, no score is
 * stored, and the run is left out of that scorer's aggregates.
 *
 * @param reason - Optional explanation, surfaced on the run result and the scorer span.
 *
 * @example
 * ```typescript
 * import { createScorer, notScorable } from '@mastra/core/evals';
 * import { extractToolCalls } from '@mastra/evals/scorers/utils';
 *
 * const refundJudge = createScorer({
 *   id: 'refund-judge',
 *   description: 'Judges how well refund requests were handled',
 *   type: 'agent',
 *   judge: { model: 'openai/gpt-5-mini', instructions: 'You judge refund handling.' },
 * })
 *   .preprocess(({ run }) => {
 *     const { tools } = extractToolCalls(run.output);
 *     return tools.includes('refundCustomer') ? { tools } : notScorable('refundCustomer was not called');
 *   })
 *   .generateScore({
 *     description: 'Score the refund handling',
 *     createPrompt: ({ run }) => `Rate this refund handling from 0 to 1:\n${JSON.stringify(run.output)}`,
 *   });
 * ```
 */
export function notScorable(reason?: string): NotScorable {
  return { [NOT_SCORABLE]: true, ...(reason !== undefined ? { reason } : {}) };
}

/**
 * Whether a scorer step returned `notScorable()`.
 */
export function isNotScorable(value: unknown): value is NotScorable {
  return typeof value === 'object' && value !== null && (value as Record<PropertyKey, unknown>)[NOT_SCORABLE] === true;
}
