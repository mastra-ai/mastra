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
 * Per-engine continuation policy. Required (no default) so every call site's
 * choice is explicit and a missed site is a compile error.
 *
 * Two ladders rather than per-behavior knobs: the four behaviors that differ
 * between the engines (hard vs soft feedback stop, stopWhen gating, the
 * feedback turn past a matched stopWhen, and the finite-maxSteps guard)
 * interact inside one decision ladder — four booleans would generate 16
 * states, of which only these 2 ever shipped. Each ladder is the contract
 * its engine shipped, verified line-for-line against the pre-extraction
 * predicates (`git show dc51cb24b3`).
 */
export type ContinuationPolicy =
  | { mode: 'durable' }
  | {
      mode: 'default';
      /**
       * True when the run has a finite maxSteps. Only the default ladder's
       * feedback force-continue consumes this (which is why it lives on the
       * policy union, not the shared deps): the shipped default contract
       * never force-continued from the feedback branch on unbounded runs — a
       * hook that always returns feedback must not spin the loop forever.
       */
      hasFiniteMaxSteps: boolean;
    };

export interface ContinuationDeps {
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
  /** Which engine's shipped continuation contract to apply. */
  policy: ContinuationPolicy;
}

/**
 * Shared dowhile-predicate decision core: given a settled iteration, decide
 * whether the loop runs another turn. Owns the two-phase
 * feedback stop, stopWhen evaluation, delegation bail, and the
 * onIterationComplete result ladder. Engine glue owns everything around it:
 * step accumulation, signal draining, message-boundary rotation, abort
 * checks, and emission.
 *
 * The mechanics are shared; the policy is per-engine, because each engine
 * shipped a different contract and each contract is grounded in that
 * engine's constraints:
 *
 * - `{ mode: 'durable' }` — the durable/evented predicate as it shipped
 *   before extraction. `pendingFeedbackStop` and delegation bail are hard
 *   stops the hook cannot override (the stop is recorded in a persisted step
 *   record before the next step is scheduled; at-least-once redelivery
 *   re-running the predicate must not reopen a settled record). stopWhen
 *   only runs while the outcome is still open (settled records must not be
 *   re-evaluated). `{ feedback, continue: false }` grants one feedback turn
 *   even past a matched stopWhen (two-phase stop).
 *
 * - `{ mode: 'default' }` — the in-process predicate as it shipped before
 *   extraction (the released contract users run against). The feedback stop
 *   is soft: `{ continue: true }` can override it — there is no persisted
 *   record and no redelivery, so the durable constraint doesn't exist here.
 *   stopWhen runs whenever the LLM wants to continue (user predicates are
 *   observable API — invocation counts and side effects are behavior).
 *   `{ feedback, continue: false }` after a matched stopWhen injects the
 *   feedback but still stops (no extra turn — an extra LLM turn would change
 *   step count, latency, and billing against the released contract). The
 *   feedback force-continue requires a finite maxSteps (runaway guard).
 *
 * Where the ladders disagree beyond the four policy behaviors above —
 * delegation bail ordering and feedback on resurrection — each ladder
 * keeps its own shipped behavior; see the inline comments for
 * the how and why of each split. Unifying them (e.g. fixing the default
 * engine's bail-flag leak or its dropped resurrection feedback) is an
 * observable behavior change to the released contract and ships separately
 * with its own product decision.
 */
export async function decideContinuation(deps: ContinuationDeps): Promise<ContinuationDecision> {
  return deps.policy.mode === 'durable'
    ? decideContinuationDurable(deps)
    : decideContinuationDefault(deps, deps.policy);
}

/**
 * The durable/evented engines' shipped predicate, unchanged by the policy
 * split — this body is the pre-extraction durable ladder byte-for-byte.
 * Hard stops, gated stopWhen, and the two-phase stop past stopWhen are all
 * consequences of persisted step records under at-least-once redelivery.
 */
async function decideContinuationDurable(deps: ContinuationDeps): Promise<ContinuationDecision> {
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

/**
 * The in-process engine's shipped predicate: a port of the dowhile block the
 * extraction removed (`git show dc51cb24b3 -- packages/core/src/loop/loop-builder.ts`,
 * the removed code is the spec), verified line-for-line against the
 * merge-base predicate (`git show a436d6c5:packages/core/src/loop/workflows/agentic-loop/index.ts`).
 * The only non-merge-base element is the extraction's maxSteps hard ceiling
 * (previously maxSteps was only enforced via the default stopWhen; the
 * ceiling was added during the extraction and is kept deliberately, not
 * part of this split).
 */
async function decideContinuationDefault(
  deps: ContinuationDeps,
  policy: Extract<ContinuationPolicy, { mode: 'default' }>,
): Promise<ContinuationDecision> {
  let hasFinishedSteps = false;
  let nextPendingFeedbackStop = false;

  // SOFT stop: the previous turn's `{ continue: false, feedback }`
  // ends the loop, but the hook's `{ continue: true }` can still resurrect
  // it below. The default engine has no persisted step record and no
  // redelivery, so durable's hard-stop constraint does not exist here; the
  // released contract let hook authors override the two-phase stop.
  if (deps.pendingFeedbackStop) {
    hasFinishedSteps = true;
  }

  const shouldContinue = deps.llmWantsToContinue;

  // stopWhen runs whenever the LLM wants to continue: no
  // underMaxSteps / !hasFinishedSteps gates. User stopWhen predicates are
  // observable API on the default engine — invocation counts and side
  // effects (logging, metrics, external calls) are behavior users shipped
  // against. Durable's gate exists only for its settled-record constraint.
  if (shouldContinue && deps.stopWhen && deps.steps.length > 0) {
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

  // The released default contract checks the delegation bail AFTER
  // the hook (see the post-hook block below), so `isFinal` here — and the
  // hook's context — is computed WITHOUT bail knowledge. Durable differs by
  // constraint: it consumes the bail before the hook as a hard stop,
  // because its stop lands in a persisted step record and at-least-once
  // redelivery must not let the hook reopen it. The default engine has no
  // persisted record, and its shipped hook contract never saw the bail.
  let isFinal = !shouldContinue || !deps.underMaxSteps || hasFinishedSteps;
  let forceContinue = false;

  if (deps.onIterationComplete && !deps.backgroundTaskPending) {
    try {
      const iterationResult = await deps.onIterationComplete(await deps.buildIterationContext(isFinal));

      if (iterationResult) {
        // The shipped default feedback gate: the LLM must already want to
        // continue. Note there is no budget gate on the injection itself —
        // old main injected feedback even over budget (shipped wart, pinned
        // by tests; fixing it would be a separate, disclosed decision).
        if (iterationResult.feedback && shouldContinue) {
          await deps.injectFeedback(iterationResult.feedback);

          if (iterationResult.continue === false) {
            nextPendingFeedbackStop = true;
            // Inject-but-halt past a matched stopWhen: when stopWhen
            // already matched (hasFinishedSteps), the run stops NOW — the
            // feedback lands in the transcript unused. Durable grants one
            // more feedback turn here; on the default engine that extra turn
            // would change step count, latency, and billing against the
            // released contract.
            if (!hasFinishedSteps) {
              isFinal = false;
            }
          } else if (!hasFinishedSteps && policy.hasFiniteMaxSteps && deps.underMaxSteps) {
            // Feedback force-continue requires a FINITE maxSteps:
            // the released default contract never force-continued from the
            // feedback branch on unbounded runs (a hook that always returns
            // feedback must not spin the loop forever).
            isFinal = false;
            forceContinue = true;
          }
        } else if (iterationResult.continue === false && !hasFinishedSteps) {
          hasFinishedSteps = true;
          isFinal = true;
        } else if (iterationResult.continue === true && (hasFinishedSteps || !shouldContinue)) {
          // Resurrection: `{ continue: true }` on a stopped run forces
          // another turn. The released default contract silently DROPS any
          // `feedback` in this branch (the feedback gate above requires the
          // LLM to already want to continue), so no injection happens here.
          // Durable differs: its ladder routes `{ continue: true, feedback }`
          // through `canRunAnotherTurn` and injects the feedback before
          // resurrecting. Fixing the drop on the default engine is a real
          // data-loss fix, but it changes the released transcript contract —
          // it ships separately with its own product decision, not in this
          // extraction.
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

  // Delegation bail (ctx.bail() from a delegation hook), checked
  // AFTER the hook exactly as the released default contract does. Two
  // shipped consequences preserved deliberately:
  // - the hook above ran with an `isFinal` computed without bail knowledge;
  // - the bail is only consumed when the loop is not already stopping. When
  //   it IS already stopping (`hasFinishedSteps`), the flag is neither read
  //   nor cleared and leaks to the next run of the scope — a shipped wart.
  //   Fixing either is a behavior change to the released contract and ships
  //   separately with its own product decision.
  // The bail wins over a hook resurrection: merge-base projected
  // `isContinued = hasFinishedSteps ? false : isContinued` after this check,
  // which `isFinal = true` (applied after forceContinue by the glue)
  // reproduces exactly.
  if (!hasFinishedSteps && deps.consumeDelegationBail()) {
    isFinal = true;
    forceContinue = false;
  }

  return { isFinal, forceContinue, nextPendingFeedbackStop };
}
