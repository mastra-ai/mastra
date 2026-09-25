// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { describe, expect, it } from 'vitest';
import type { WorkflowStepTiming } from '../workflow-step-timing';
import { isAwaitingInput, resolveRunTiming, resolveStepSpan } from '../workflow-step-timing';

// Fixtures captured from a real engine run: suspended, then resumed 300ms later.
const suspendedLeaf: WorkflowStepTiming = { status: 'suspended', startedAt: 1_000, suspendedAt: 1_022 };
const nestedParentWhileWaiting: WorkflowStepTiming = { status: 'running', startedAt: 1_000, suspendedAt: 1_022 };
const resumedAndDone: WorkflowStepTiming = {
  status: 'success',
  startedAt: 1_000,
  resumedAt: 301_022,
  endedAt: 301_027,
};

describe('isAwaitingInput', () => {
  it('holds for a suspended leaf and for a nested parent that still reports running', () => {
    expect(isAwaitingInput(suspendedLeaf)).toBe(true);
    expect(isAwaitingInput(nestedParentWhileWaiting)).toBe(true);
  });

  it('does not hold once the step has come back or finished', () => {
    expect(isAwaitingInput(resumedAndDone)).toBe(false);
    expect(isAwaitingInput({ status: 'running', startedAt: 1_000 })).toBe(false);
    expect(isAwaitingInput({ status: 'waiting', startedAt: 1_000 })).toBe(false);
  });

  it('holds again when a looping step suspends after a previous resume', () => {
    expect(isAwaitingInput({ status: 'suspended', startedAt: 1_000, resumedAt: 2_000, suspendedAt: 2_500 })).toBe(true);
  });
});

describe('resolveStepSpan', () => {
  it('closes a waiting step at its suspension so no clock counts human time', () => {
    expect(resolveStepSpan(suspendedLeaf)).toEqual({ start: 1_000, end: 1_022, isLive: false, spansSuspension: false });
    expect(resolveStepSpan(nestedParentWhileWaiting)).toEqual({
      start: 1_000,
      end: 1_022,
      isLive: false,
      spansSuspension: false,
    });
  });

  it('keeps a genuinely running step live', () => {
    expect(resolveStepSpan({ status: 'running', startedAt: 1_000 })).toEqual({
      start: 1_000,
      end: undefined,
      isLive: true,
      spansSuspension: false,
    });
  });

  it('flags a finished span that swallowed a wait instead of silently reporting it as execution', () => {
    expect(resolveStepSpan(resumedAndDone)).toEqual({
      start: 1_000,
      end: 301_027,
      isLive: false,
      spansSuspension: true,
    });
  });

  it.each([
    ['no start', { status: 'success', endedAt: 2_000 }],
    ['unusable start', { status: 'success', startedAt: NaN, endedAt: 2_000 }],
  ] satisfies [string, WorkflowStepTiming][])('yields no span for %s', (_case, timing) => {
    expect(resolveStepSpan(timing)).toBeUndefined();
  });

  it.each([
    ['an end before the start', { status: 'success', startedAt: 2_000, endedAt: 1_000 }],
    ['an infinite end', { status: 'success', startedAt: 1_000, endedAt: Infinity }],
  ] satisfies [string, WorkflowStepTiming][])('leaves the span unmeasured for %s', (_case, timing) => {
    expect(resolveStepSpan(timing)?.end).toBeUndefined();
  });
});

describe('resolveRunTiming', () => {
  it('stops a suspended run at the suspension and exposes what the wait started from', () => {
    expect(
      resolveRunTiming(
        { work: { status: 'success', startedAt: 1_000, endedAt: 1_010 }, approval: suspendedLeaf },
        'suspended',
      ),
    ).toEqual({ span: { startedAt: 1_000, endedAt: 1_022 }, spansSuspension: false, waitingSince: 1_022 });
  });

  it('counts a branch that kept working past the suspension, and waits from the first one', () => {
    expect(
      resolveRunTiming(
        {
          approval: suspendedLeaf,
          review: { status: 'suspended', startedAt: 1_000, suspendedAt: 1_030 },
          sibling: { status: 'success', startedAt: 1_000, endedAt: 1_500 },
        },
        'suspended',
      ),
    ).toEqual({ span: { startedAt: 1_000, endedAt: 1_500 }, spansSuspension: false, waitingSince: 1_022 });
  });

  it('keeps a sleeping run counting, because nobody is being waited on', () => {
    expect(resolveRunTiming({ nap: { status: 'waiting', startedAt: 1_000 } }, 'waiting')).toEqual({
      span: { startedAt: 1_000 },
      spansSuspension: false,
    });
  });

  it('marks a finished run that came back from a suspension', () => {
    expect(resolveRunTiming({ approval: resumedAndDone }, 'success')).toEqual({
      span: { startedAt: 1_000, endedAt: 301_027 },
      spansSuspension: true,
    });
  });

  it('reports nothing measurable for a finished run with no usable timestamps', () => {
    expect(resolveRunTiming({ pending: { status: 'running', startedAt: 1_000 } }, 'success')).toBeUndefined();
    expect(resolveRunTiming({}, 'success')).toBeUndefined();
  });
});
