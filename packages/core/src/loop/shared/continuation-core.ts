import type { IterationCompleteContext, OnIterationCompleteHandler } from '../../agent/agent.types';
import type { IMastraLogger } from '../../logger';
import type { LoopOptions } from '../types';

/** Decision returned by {@link decideContinuation}, projected back onto engine state by the glue. */
export interface ContinuationDecision {
  /** True when the loop must stop after this iteration. */
  isFinal: boolean;
  /**
   * True when the onIterationComplete hook forced another turn that the
   * engine's own step result would not have taken (continue-override or
   * feedback resurrection). Glue must set its `isContinued` flag so
   * downstream consumers (stopWhen next iteration, finish reason) agree
   * with the decision.
   */
  forceContinue: boolean;
  /**
   * Two-phase stop: `{ continue: false, feedback }` allows one more LLM turn
   * with the feedback, then stops. Glue persists this for the next predicate
   * evaluation (closure state on main, serialized IterationState on durable).
   */
  nextPendingFeedbackStop: boolean;
}

/**
 * Shared dowhile-predicate decision core (PHASE3 Step 3): given a settled
 * iteration, decide whether the loop runs another turn. Owns the two-phase
 * feedback stop, stopWhen evaluation, delegation bail, and the
 * onIterationComplete result ladder. Engine glue owns everything around it:
 * step accumulation, signal draining, message-boundary rotation, abort
 * checks, and emission.
 *
 * Hard stops (`pendingFeedbackStop` from the previous turn, delegation bail)
 * are unconditional — the onIterationComplete hook cannot override them.
 * stopWhen is soft: the hook may still force-continue or run one feedback
 * turn past a matched condition (the two-phase stop then fires next turn).
 *
 * Adjudicated drift (previously engine-specific):
 * - `pendingFeedbackStop` and delegation bail are hard stops on both engines
 *   (previously main let `continue: true` override the two-phase stop, and
 *   only durable had the hard-stop concept).
 * - Delegation bail is consumed before the hook runs so the hook's `isFinal`
 *   context reflects it (main checked bail after the hook).
 * - `{ feedback, continue: true }` when the LLM already signaled done now
 *   injects the feedback AND resurrects the loop (main force-continued but
 *   silently dropped the feedback message).
 * - `{ feedback, continue: false }` after a matched stopWhen honors the
 *   two-phase stop (main injected the feedback but stopped immediately,
 *   wasting the feedback turn and leaking the pending flag).
 * - Feedback force-continue no longer requires a finite maxSteps on main
 *   (glue passes `underMaxSteps: true` for unbounded runs).
 * - stopWhen conditions are only evaluated while the outcome is still open
 *   (durable's gate; main evaluated them even when already stopping).
 */
export async function decideContinuation(deps: {
  /** Previous turn returned `{ continue: false, feedback }` — this turn ran with the feedback, stop now. */
  pendingFeedbackStop: boolean;
  /** The engine's own continuation flag after all in-iteration steps ran (stepResult/lastStepResult.isContinued). */
  llmWantsToContinue: boolean;
  /** Glue-computed: `iterations < maxSteps`, or `true` when the run is unbounded. */
  underMaxSteps: boolean;
  /** Accumulated steps across iterations (including the current one), passed to stopWhen. */
  steps: unknown[];
  stopWhen?: LoopOptions['stopWhen'];
  /** Read AND clear the engine's delegation-bail flag (RunScope on main, IterationState on durable). */
  consumeDelegationBail: () => boolean;
  /** A background task result was just injected — skip the hook, the loop is mid-task. */
  backgroundTaskPending?: boolean;
  onIterationComplete?: OnIterationCompleteHandler;
  /** Lazy: only invoked when the hook runs. `isFinal` is the pre-hook decision. */
  buildIterationContext: (isFinal: boolean) => IterationCompleteContext | Promise<IterationCompleteContext>;
  /** Append the hook's feedback as a synthetic assistant message the next turn will see. */
  injectFeedback: (feedback: string) => void | Promise<void>;
  logger?: IMastraLogger;
}): Promise<ContinuationDecision> {
  let hasFinishedSteps = false;
  // Hard-stop tracks reasons the onIterationComplete hook must NOT override.
  let hardStop = false;
  let nextPendingFeedbackStop = false;

  // Two-phase stop: the previous predicate evaluation granted one more LLM
  // turn with the hook's feedback. That turn has now completed — stop
  // unconditionally.
  if (deps.pendingFeedbackStop) {
    hasFinishedSteps = true;
    hardStop = true;
  }

  const shouldContinue = deps.llmWantsToContinue;

  // Evaluate user-supplied stopWhen predicate(s), but only while the outcome
  // is still open — a loop that is already stopping (or out of budget) never
  // needs them.
  if (shouldContinue && deps.underMaxSteps && !hasFinishedSteps && deps.stopWhen && deps.steps.length > 0) {
    // Cast steps to any for v5/v6 StopCondition compatibility — the step
    // shapes differ slightly (rawFinishReason, finishReason format) but are
    // compatible at runtime for stop condition evaluation.
    const steps = deps.steps as any;
    const conditions = await Promise.all(
      (Array.isArray(deps.stopWhen) ? deps.stopWhen : [deps.stopWhen]).map(condition => condition({ steps })),
    );
    if (conditions.some(Boolean)) {
      hasFinishedSteps = true;
    }
  }

  // Delegation bail (ctx.bail() from a delegation hook) is a hard stop.
  // Consumed before the hook so its isFinal context reflects the bail.
  if (deps.consumeDelegationBail()) {
    hasFinishedSteps = true;
    hardStop = true;
  }

  let isFinal = !shouldContinue || !deps.underMaxSteps || hasFinishedSteps;
  let forceContinue = false;

  // The onIterationComplete hook runs for every settled iteration (not just
  // continued ones) — except while a background task result is pending, when
  // the "iteration" is a bookkeeping turn the supervisor should not see.
  if (deps.onIterationComplete && !deps.backgroundTaskPending) {
    try {
      const iterationResult = await deps.onIterationComplete(await deps.buildIterationContext(isFinal));

      if (iterationResult) {
        // Whether another turn is even possible: hard stops are
        // unconditional, budget is a ceiling, and beyond that either the
        // LLM already wanted to continue or the hook explicitly asked to.
        const canRunAnotherTurn =
          !hardStop && deps.underMaxSteps && (shouldContinue || iterationResult.continue === true);

        if (iterationResult.feedback && canRunAnotherTurn) {
          // Inject feedback as a synthetic assistant message so the LLM sees
          // it next turn (marked suppressFeedback so isTaskComplete scorers
          // skip it — glue owns that metadata).
          await deps.injectFeedback(iterationResult.feedback);

          if (iterationResult.continue === false) {
            // Two-phase stop: one more LLM turn with the feedback, then the
            // pendingFeedbackStop hard stop fires on the next evaluation.
            nextPendingFeedbackStop = true;
            isFinal = false;
          } else if (!hasFinishedSteps) {
            isFinal = false;
            forceContinue = true;
          }
        } else if (iterationResult.continue === false && !hasFinishedSteps) {
          hasFinishedSteps = true;
          isFinal = true;
        } else if (iterationResult.continue === true && !hardStop && (hasFinishedSteps || !shouldContinue)) {
          if (deps.underMaxSteps) {
            hasFinishedSteps = false;
            isFinal = false;
            forceContinue = true;
          }
        }
      }
    } catch (error) {
      // Log error but don't fail the iteration — the pre-hook decision stands.
      deps.logger?.error('Error in onIterationComplete hook:', error);
    }
  }

  return { isFinal, forceContinue, nextPendingFeedbackStop };
}
