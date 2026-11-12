import { describe, expect, it } from 'vitest';
import type { ClassifierStepEntry, StepFlowEntry, WorkflowRunState } from '../../types';
import { finishedOccurrence } from './finished-occurrence';

describe('finishedOccurrence', () => {
  it('runs the second use of a classifier step its delivery carries the first result of', () => {
    const classify = {
      type: 'classifier',
      id: 'classify',
      classifierId: 'classify',
      classifier: {},
    } as ClassifierStepEntry;
    const between = { type: 'mapping', id: 'between' } as unknown as StepFlowEntry;
    const first = { status: 'success', output: {}, payload: {}, startedAt: 1, endedAt: 2 } as const;

    // The second use's delivery carries the first use's result, as the step before it saved it.
    const outcome = finishedOccurrence({
      step: classify,
      executionPath: [2],
      stepResults: { classify: first },
      restart: undefined,
      snapshot: { status: 'running', activePaths: [1], context: { classify: first } } as unknown as WorkflowRunState,
      stepGuards: false,
      guarded: false,
      stepGraph: [classify, between, classify],
    });

    expect(outcome).toBe('run');
  });
});
