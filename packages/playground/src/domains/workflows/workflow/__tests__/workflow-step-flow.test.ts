import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';

import {
  buildNextStepInput,
  buildStepSuccessors,
  collectGraphStepFlags,
  isBranchArmBypassed,
  isLastRunnableStep,
  selectNextStepKey,
} from '../utils';

describe('buildStepSuccessors', () => {
  it('inverts a predecessor map into a successor map', () => {
    // stepsFlow: each step -> its predecessors
    const stepsFlow = {
      b: ['a'],
      join: ['b', 'c'],
    };

    expect(buildStepSuccessors(stepsFlow)).toEqual({
      a: ['b'],
      b: ['join'],
      c: ['join'],
    });
  });

  it('deduplicates repeated successors', () => {
    const stepsFlow = {
      join: ['a', 'a'],
    };

    expect(buildStepSuccessors(stepsFlow)).toEqual({ a: ['join'] });
  });
});

describe('collectGraphStepFlags', () => {
  it('collects conditional arm ids but not parallel arm ids', () => {
    const stepGraph = [
      { type: 'parallel', steps: [{ type: 'step', step: { id: 'p1' } }, { type: 'step', step: { id: 'p2' } }] },
      { type: 'conditional', steps: [{ type: 'step', step: { id: 'short' } }, { type: 'step', step: { id: 'long' } }] },
    ] as unknown as SerializedStepFlowEntry[];

    const { conditionalStepIds, nestedWorkflowStepIds } = collectGraphStepFlags(stepGraph);

    expect([...conditionalStepIds]).toEqual(['short', 'long']);
    expect(nestedWorkflowStepIds.size).toBe(0);
  });

  it('flags nested workflow steps by component', () => {
    const stepGraph = [
      { type: 'step', step: { id: 'plain', component: 'STEP' } },
      { type: 'step', step: { id: 'nested', component: 'WORKFLOW' } },
    ] as unknown as SerializedStepFlowEntry[];

    const { nestedWorkflowStepIds } = collectGraphStepFlags(stepGraph);

    expect([...nestedWorkflowStepIds]).toEqual(['nested']);
  });

  it('returns empty sets for an undefined graph', () => {
    const { conditionalStepIds, nestedWorkflowStepIds } = collectGraphStepFlags(undefined);

    expect(conditionalStepIds.size).toBe(0);
    expect(nestedWorkflowStepIds.size).toBe(0);
  });
});

describe('isBranchArmBypassed', () => {
  // A conditional with two arms (short, long) that both feed a single join.
  const conditionalStepIds = new Set(['short', 'long']);
  const stepsFlow = { join: ['short', 'long'] };
  const stepSuccessors = { short: ['join'], long: ['join'] };

  it('bypasses an un-taken conditional arm once a sibling on the join has succeeded', () => {
    const isStepSuccess = (id: string) => id === 'short';

    expect(
      isBranchArmBypassed({ stepId: 'long', conditionalStepIds, stepSuccessors, stepsFlow, isStepSuccess }),
    ).toBe(true);
  });

  it('does not bypass an arm while no sibling has succeeded yet', () => {
    const isStepSuccess = () => false;

    expect(
      isBranchArmBypassed({ stepId: 'long', conditionalStepIds, stepSuccessors, stepsFlow, isStepSuccess }),
    ).toBe(false);
  });

  it('never bypasses a parallel arm even when a sibling on the shared join has succeeded', () => {
    // Parallel arms are absent from conditionalStepIds, so every arm must still run.
    const parallelConditionalStepIds = new Set<string>();
    const parallelStepsFlow = { join: ['p1', 'p2'] };
    const parallelSuccessors = { p1: ['join'], p2: ['join'] };
    const isStepSuccess = (id: string) => id === 'p1';

    expect(
      isBranchArmBypassed({
        stepId: 'p2',
        conditionalStepIds: parallelConditionalStepIds,
        stepSuccessors: parallelSuccessors,
        stepsFlow: parallelStepsFlow,
        isStepSuccess,
      }),
    ).toBe(false);
  });
});

describe('selectNextStepKey', () => {
  const stepNodesInOrder = ['a', 'b', 'c'];
  const noneBypassed = () => false;

  it('selects the first step that has not yet succeeded', () => {
    const isStepSuccess = (id: string) => id === 'a';

    expect(
      selectNextStepKey({ stepNodesInOrder, isStepSuccess, isStepBypassed: noneBypassed }),
    ).toBe('b');
  });

  it('skips a bypassed branch arm and selects the next runnable step', () => {
    const isStepSuccess = (id: string) => id === 'a';
    const isStepBypassed = (id: string) => id === 'b';

    expect(selectNextStepKey({ stepNodesInOrder, isStepSuccess, isStepBypassed })).toBe('c');
  });

  it('returns undefined when every step has succeeded', () => {
    expect(
      selectNextStepKey({ stepNodesInOrder, isStepSuccess: () => true, isStepBypassed: noneBypassed }),
    ).toBeUndefined();
  });
});

describe('isLastRunnableStep', () => {
  const stepNodesInOrder = ['a', 'b', 'c'];

  it('is true when no later step still needs to run', () => {
    const isStepSuccess = (id: string) => id === 'c';

    expect(
      isLastRunnableStep({ nextStepKey: 'b', stepNodesInOrder, isStepSuccess, isStepBypassed: () => false }),
    ).toBe(true);
  });

  it('treats bypassed later steps as not needing to run', () => {
    const isStepSuccess = () => false;
    const isStepBypassed = (id: string) => id === 'c';

    expect(isLastRunnableStep({ nextStepKey: 'b', stepNodesInOrder, isStepSuccess, isStepBypassed })).toBe(true);
  });

  it('is false when a later step still needs to run', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: 'a',
        stepNodesInOrder,
        isStepSuccess: () => false,
        isStepBypassed: () => false,
      }),
    ).toBe(false);
  });

  it('is false when there is no next step', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: undefined,
        stepNodesInOrder,
        isStepSuccess: () => true,
        isStepBypassed: () => false,
      }),
    ).toBe(false);
  });
});

describe('buildNextStepInput', () => {
  it('passes a single predecessor output directly', () => {
    const stepsFlow = { b: ['a'] };
    const steps = { a: { status: 'success', output: { value: 1 } } };

    expect(buildNextStepInput({ nextStepKey: 'b', stepsFlow, steps })).toEqual({
      hasMultiSteps: false,
      input: { value: 1 },
    });
  });

  it('builds a keyed map of outputs for a join with multiple predecessors', () => {
    const stepsFlow = { join: ['a', 'b'] };
    const steps = {
      a: { status: 'success', output: { x: 1 } },
      b: { status: 'success', output: { y: 2 } },
    };

    expect(buildNextStepInput({ nextStepKey: 'join', stepsFlow, steps })).toEqual({
      hasMultiSteps: true,
      input: { a: { x: 1 }, b: { y: 2 } },
    });
  });

  it('returns undefined when the single predecessor has not succeeded', () => {
    const stepsFlow = { b: ['a'] };
    const steps = { a: { status: 'running' } };

    expect(buildNextStepInput({ nextStepKey: 'b', stepsFlow, steps })).toBeUndefined();
  });

  it('returns undefined when the step has no predecessor or no next step', () => {
    expect(buildNextStepInput({ nextStepKey: 'orphan', stepsFlow: {}, steps: {} })).toBeUndefined();
    expect(buildNextStepInput({ nextStepKey: undefined, stepsFlow: {}, steps: {} })).toBeUndefined();
  });
});
