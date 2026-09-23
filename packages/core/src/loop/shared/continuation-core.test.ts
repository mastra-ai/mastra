import { describe, expect, it, vi } from 'vitest';

import type { ContinuationDeps } from './continuation-core';
import { decideContinuation } from './continuation-core';

/**
 * Truth-table tests for the per-engine continuation policy split.
 *
 * Every scenario that diverges between the two ladders is asserted on BOTH
 * modes so the split itself is pinned: `{ mode: 'default' }` is the
 * in-process engine's released contract (the pre-extraction predicate,
 * `git show dc51cb24b3`), `{ mode: 'durable' }` is the durable/evented
 * engines' shipped predicate. Shipped warts of the default contract (e.g.
 * feedback injected on a halting run) are pinned deliberately — fixing them
 * would be a separate, disclosed decision.
 */
function makeDeps(overrides: Partial<ContinuationDeps> = {}): ContinuationDeps {
  return {
    policy: { mode: 'default', hasFiniteMaxSteps: true },
    pendingFeedbackStop: false,
    llmWantsToContinue: false,
    underMaxSteps: true,
    steps: [{}],
    consumeDelegationBail: () => false,
    buildIterationContext: isFinal => ({ isFinal }) as any,
    injectFeedback: () => {},
    ...overrides,
  };
}

describe('decideContinuation — D1.1 pendingFeedbackStop finality', () => {
  it('default: the feedback stop is soft — the hook can resurrect the run with { continue: true }', async () => {
    const decision = await decideContinuation(
      makeDeps({
        policy: { mode: 'default', hasFiniteMaxSteps: true },
        pendingFeedbackStop: true,
        llmWantsToContinue: false,
        onIterationComplete: async () => ({ continue: true }),
      }),
    );
    expect(decision).toEqual({ isFinal: false, forceContinue: true, nextPendingFeedbackStop: false });
  });

  it('durable: the feedback stop is hard — { continue: true } cannot reopen a settled record', async () => {
    const decision = await decideContinuation(
      makeDeps({
        policy: { mode: 'durable' },
        pendingFeedbackStop: true,
        llmWantsToContinue: false,
        onIterationComplete: async () => ({ continue: true }),
      }),
    );
    expect(decision).toEqual({ isFinal: true, forceContinue: false, nextPendingFeedbackStop: false });
  });
});

describe('decideContinuation — D1.2 delegation bail consumed before the hook (kept fix, both modes)', () => {
  it('default: the bail flag is consumed exactly once even when the loop is already stopping', async () => {
    const consumeDelegationBail = vi.fn(() => true);
    const decision = await decideContinuation(
      makeDeps({
        // Old main's post-hook gate (`!hasFinishedSteps`) would have skipped
        // the read here and leaked the flag into the next run of the scope.
        pendingFeedbackStop: true,
        llmWantsToContinue: false,
        consumeDelegationBail,
        onIterationComplete: async () => ({ continue: true }),
      }),
    );
    expect(consumeDelegationBail).toHaveBeenCalledTimes(1);
    // A bail is a hard stop even on the default ladder — { continue: true }
    // must not override it.
    expect(decision.isFinal).toBe(true);
    expect(decision.forceContinue).toBe(false);
  });

  it('default: the hook receives isFinal=true when a bail is pending on an otherwise-continuing run', async () => {
    const seenIsFinal: boolean[] = [];
    const decision = await decideContinuation(
      makeDeps({
        llmWantsToContinue: true,
        consumeDelegationBail: () => true,
        buildIterationContext: isFinal => {
          seenIsFinal.push(isFinal);
          return { isFinal } as any;
        },
        onIterationComplete: async () => undefined,
      }),
    );
    // Old main checked the bail after the hook, so the hook saw isFinal=false.
    expect(seenIsFinal).toEqual([true]);
    expect(decision.isFinal).toBe(true);
  });
});

describe('decideContinuation — D1.3 feedback preserved on hook resurrection (kept fix, both modes)', () => {
  it('default: { continue: true, feedback } on a stopped run injects the feedback instead of dropping it', async () => {
    const injectFeedback = vi.fn();
    const decision = await decideContinuation(
      makeDeps({
        llmWantsToContinue: false,
        injectFeedback,
        onIterationComplete: async () => ({ continue: true, feedback: 'fix it' }),
      }),
    );
    expect(injectFeedback).toHaveBeenCalledWith('fix it');
    expect(decision.isFinal).toBe(false);
    expect(decision.forceContinue).toBe(true);
  });

  it('durable: same inputs also inject the feedback', async () => {
    const injectFeedback = vi.fn();
    const decision = await decideContinuation(
      makeDeps({
        policy: { mode: 'durable' },
        llmWantsToContinue: false,
        injectFeedback,
        onIterationComplete: async () => ({ continue: true, feedback: 'fix it' }),
      }),
    );
    expect(injectFeedback).toHaveBeenCalledWith('fix it');
    expect(decision.isFinal).toBe(false);
    expect(decision.forceContinue).toBe(true);
  });
});

describe('decideContinuation — D1.4 feedback after a matched stopWhen', () => {
  const hook = async () => ({ feedback: 'course-correct', continue: false });

  it('default: inject-but-halt — the run stops now, the feedback lands in the transcript unused (pinned wart)', async () => {
    const injectFeedback = vi.fn();
    const decision = await decideContinuation(
      makeDeps({
        llmWantsToContinue: true,
        stopWhen: [() => true] as any,
        injectFeedback,
        onIterationComplete: hook,
      }),
    );
    // Shipped wart: the feedback IS injected even though no turn will see it.
    expect(injectFeedback).toHaveBeenCalledWith('course-correct');
    expect(decision.isFinal).toBe(true);
    expect(decision.nextPendingFeedbackStop).toBe(true);
  });

  it('durable: two-phase stop — one more LLM turn with the feedback is granted', async () => {
    const injectFeedback = vi.fn();
    const decision = await decideContinuation(
      makeDeps({
        policy: { mode: 'durable' },
        llmWantsToContinue: true,
        stopWhen: [() => true] as any,
        injectFeedback,
        onIterationComplete: hook,
      }),
    );
    expect(injectFeedback).toHaveBeenCalledWith('course-correct');
    expect(decision.isFinal).toBe(false);
    expect(decision.nextPendingFeedbackStop).toBe(true);
  });
});

describe('decideContinuation — D1.5 feedback force-continue requires a finite maxSteps (default ladder)', () => {
  const hook = async () => ({ feedback: 'keep going' });

  it('default unbounded: feedback alone never force-continues (runaway guard)', async () => {
    const injectFeedback = vi.fn();
    const decision = await decideContinuation(
      makeDeps({
        policy: { mode: 'default', hasFiniteMaxSteps: false },
        llmWantsToContinue: true,
        injectFeedback,
        onIterationComplete: hook,
      }),
    );
    // The injection itself still happens (shipped contract) …
    expect(injectFeedback).toHaveBeenCalledWith('keep going');
    // … but the force-continue branch is gated on a finite maxSteps.
    expect(decision.forceContinue).toBe(false);
    expect(decision.isFinal).toBe(false);
  });

  it('default finite: feedback force-continues while under budget', async () => {
    const decision = await decideContinuation(
      makeDeps({
        policy: { mode: 'default', hasFiniteMaxSteps: true },
        llmWantsToContinue: true,
        onIterationComplete: hook,
      }),
    );
    expect(decision.forceContinue).toBe(true);
    expect(decision.isFinal).toBe(false);
  });
});

describe('decideContinuation — D1.6 stopWhen evaluation gating', () => {
  it('default: user stopWhen predicates run even when the outcome is already closed', async () => {
    const stopWhenSpy = vi.fn(() => false);
    await decideContinuation(
      makeDeps({
        pendingFeedbackStop: true, // outcome closed
        llmWantsToContinue: true,
        stopWhen: [stopWhenSpy] as any,
      }),
    );
    // Predicate invocation counts and side effects are observable API on the
    // released default contract.
    expect(stopWhenSpy).toHaveBeenCalledTimes(1);
  });

  it('durable: stopWhen predicates are skipped once the outcome is closed', async () => {
    const stopWhenSpy = vi.fn(() => false);
    await decideContinuation(
      makeDeps({
        policy: { mode: 'durable' },
        pendingFeedbackStop: true,
        llmWantsToContinue: true,
        stopWhen: [stopWhenSpy] as any,
      }),
    );
    expect(stopWhenSpy).not.toHaveBeenCalled();
  });
});
