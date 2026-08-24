import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import {
  allPredecessorsResolved,
  buildNextStepInput,
  buildStepSuccessors,
  buildStepsFlow,
  collectGraphStepFlags,
  findFocusNode,
  isBranchArmBypassed,
  isLastRunnableStep,
  selectNextStepKey,
} from '../utils';
import type { WorkflowGraphEdge } from '../utils';

/** A graph edge as the workflow view builds them: `previous -> next`. */
const edge = (previousStepId: string, nextStepId: string, extra: Record<string, unknown> = {}): WorkflowGraphEdge =>
  ({
    id: `${previousStepId}->${nextStepId}`,
    source: previousStepId,
    target: nextStepId,
    data: { previousStepId, nextStepId, ...extra },
  }) as unknown as WorkflowGraphEdge;

const step = (id: string): SerializedStepFlowEntry => ({ type: 'step', step: { id, description: id } });

/** Reads succeeded step ids out of a plain set, as the run view does. */
const succeeded =
  (...ids: string[]) =>
  (stepId: string) =>
    ids.includes(stepId);

describe('buildStepsFlow', () => {
  it('maps each step to the steps that come before it', () => {
    expect(buildStepsFlow([edge('a', 'b'), edge('b', 'c')])).toEqual({ b: ['a'], c: ['b'] });
  });

  it('collects every predecessor of a join', () => {
    expect(buildStepsFlow([edge('a', 'join'), edge('b', 'join')])).toEqual({ join: ['a', 'b'] });
  });

  it('records a repeated edge only once', () => {
    expect(buildStepsFlow([edge('a', 'b'), edge('a', 'b')])).toEqual({ b: ['a'] });
  });

  it('ignores an edge that carries no data', () => {
    const bare = { id: 'x', source: 'a', target: 'b' } as unknown as WorkflowGraphEdge;

    expect(buildStepsFlow([bare])).toEqual({});
  });

  it('ignores a boundary edge, which frames a nested workflow rather than linking steps', () => {
    expect(buildStepsFlow([edge('a', 'b', { boundaryPayload: { kind: 'workflow' } })])).toEqual({});
  });

  it.each([
    ['no next step', edge('a', '')],
    ['no previous step', edge('', 'b')],
  ])('ignores an edge with %s', (_label, incomplete) => {
    expect(buildStepsFlow([incomplete])).toEqual({});
  });

  it('reports nothing for a graph with no edges', () => {
    expect(buildStepsFlow([])).toEqual({});
  });
});

describe('buildStepSuccessors', () => {
  it('inverts the predecessor map into a successor map', () => {
    expect(buildStepSuccessors({ b: ['a'], c: ['b'] })).toEqual({ a: ['b'], b: ['c'] });
  });

  it('lists every step that depends on a shared predecessor', () => {
    expect(buildStepSuccessors({ b: ['a'], c: ['a'] })).toEqual({ a: ['b', 'c'] });
  });

  it('records a repeated dependency only once', () => {
    expect(buildStepSuccessors({ b: ['a', 'a'] })).toEqual({ a: ['b'] });
  });

  it('reports nothing for an empty flow', () => {
    expect(buildStepSuccessors({})).toEqual({});
  });
});

describe('collectGraphStepFlags', () => {
  it('flags each arm of a conditional, since only those can be skipped', () => {
    const { conditionalStepIds } = collectGraphStepFlags([
      { type: 'conditional', steps: [step('arm-a'), step('arm-b')], serializedConditions: [] },
    ] as SerializedStepFlowEntry[]);

    expect([...conditionalStepIds].sort()).toEqual(['arm-a', 'arm-b']);
  });

  it('leaves parallel arms unflagged, because every one of them must run', () => {
    const { conditionalStepIds } = collectGraphStepFlags([
      { type: 'parallel', steps: [step('arm-a'), step('arm-b')] },
    ] as SerializedStepFlowEntry[]);

    expect([...conditionalStepIds]).toEqual([]);
  });

  it('walks into a parallel entry to find the conditionals inside it', () => {
    const { conditionalStepIds } = collectGraphStepFlags([
      {
        type: 'parallel',
        steps: [{ type: 'conditional', steps: [step('inner-arm')], serializedConditions: [] }],
      },
    ] as unknown as SerializedStepFlowEntry[]);

    expect([...conditionalStepIds]).toEqual(['inner-arm']);
  });

  it('walks into a conditional arm to find the conditionals nested under it', () => {
    const { conditionalStepIds } = collectGraphStepFlags([
      {
        type: 'conditional',
        steps: [{ type: 'conditional', steps: [step('inner-arm')], serializedConditions: [] }],
        serializedConditions: [],
      },
    ] as unknown as SerializedStepFlowEntry[]);

    expect([...conditionalStepIds]).toContain('inner-arm');
  });

  it('flags a top-level nested workflow as one atomic step', () => {
    const { nestedWorkflowStepIds } = collectGraphStepFlags([
      { type: 'workflow', id: 'sub-flow', steps: [] },
    ] as unknown as SerializedStepFlowEntry[]);

    expect([...nestedWorkflowStepIds]).toEqual(['sub-flow']);
  });

  it('does not walk inside a nested workflow, since the parent treats it as one step', () => {
    const { conditionalStepIds } = collectGraphStepFlags([
      {
        type: 'workflow',
        id: 'sub-flow',
        steps: [{ type: 'conditional', steps: [step('inner-arm')], serializedConditions: [] }],
      },
    ] as unknown as SerializedStepFlowEntry[]);

    expect([...conditionalStepIds]).toEqual([]);
  });

  it.each([
    ['a step', { type: 'step', step: { id: 'sub', component: 'WORKFLOW' } }],
    ['a foreach', { type: 'foreach', step: { type: 'step', step: { id: 'sub', component: 'WORKFLOW' } } }],
    ['a loop', { type: 'loop', step: { type: 'step', step: { id: 'sub', component: 'WORKFLOW' } } }],
  ])('flags a nested workflow wrapped in %s', (_label, entry) => {
    const { nestedWorkflowStepIds } = collectGraphStepFlags([entry] as unknown as SerializedStepFlowEntry[]);

    expect([...nestedWorkflowStepIds]).toEqual(['sub']);
  });

  it('does not flag an ordinary step as a nested workflow', () => {
    const { nestedWorkflowStepIds } = collectGraphStepFlags([step('plain')]);

    expect([...nestedWorkflowStepIds]).toEqual([]);
  });

  it('flags nothing for a workflow with no graph', () => {
    expect(collectGraphStepFlags(undefined)).toEqual({
      conditionalStepIds: new Set(),
      nestedWorkflowStepIds: new Set(),
    });
  });
});

describe('isBranchArmBypassed', () => {
  const conditionalStepIds = new Set(['arm-a', 'arm-b']);
  const stepsFlow = { join: ['arm-a', 'arm-b'] };
  const stepSuccessors = { 'arm-a': ['join'], 'arm-b': ['join'] };

  it('bypasses an arm once a sibling on the same join has succeeded', () => {
    expect(
      isBranchArmBypassed({
        stepId: 'arm-a',
        conditionalStepIds,
        stepSuccessors,
        stepsFlow,
        isStepSuccess: succeeded('arm-b'),
      }),
    ).toBe(true);
  });

  it('does not bypass an arm while no sibling has run', () => {
    expect(
      isBranchArmBypassed({
        stepId: 'arm-a',
        conditionalStepIds,
        stepSuccessors,
        stepsFlow,
        isStepSuccess: succeeded(),
      }),
    ).toBe(false);
  });

  it('does not bypass an arm on the strength of its own success', () => {
    expect(
      isBranchArmBypassed({
        stepId: 'arm-a',
        conditionalStepIds,
        stepSuccessors,
        stepsFlow,
        isStepSuccess: succeeded('arm-a'),
      }),
    ).toBe(false);
  });

  it('never bypasses a step that is not a conditional arm', () => {
    // Parallel arms share a join too, so without this guard a finished arm
    // would wrongly mark its siblings dead.
    expect(
      isBranchArmBypassed({
        stepId: 'arm-a',
        conditionalStepIds: new Set(),
        stepSuccessors,
        stepsFlow,
        isStepSuccess: succeeded('arm-b'),
      }),
    ).toBe(false);
  });

  it('does not bypass an arm that leads nowhere', () => {
    expect(
      isBranchArmBypassed({
        stepId: 'arm-a',
        conditionalStepIds,
        stepSuccessors: {},
        stepsFlow,
        isStepSuccess: succeeded('arm-b'),
      }),
    ).toBe(false);
  });

  it('does not bypass an arm whose join records no other predecessor', () => {
    expect(
      isBranchArmBypassed({
        stepId: 'arm-a',
        conditionalStepIds,
        stepSuccessors,
        stepsFlow: {},
        isStepSuccess: succeeded('arm-b'),
      }),
    ).toBe(false);
  });
});

describe('selectNextStepKey', () => {
  const order = ['a', 'b', 'c'];

  it('picks the first step that has not run yet', () => {
    expect(
      selectNextStepKey({ stepNodesInOrder: order, isStepSuccess: succeeded('a'), isStepBypassed: succeeded() }),
    ).toBe('b');
  });

  it('skips over a bypassed branch arm', () => {
    expect(
      selectNextStepKey({ stepNodesInOrder: order, isStepSuccess: succeeded('a'), isStepBypassed: succeeded('b') }),
    ).toBe('c');
  });

  it('picks nothing once every step is accounted for', () => {
    expect(
      selectNextStepKey({
        stepNodesInOrder: order,
        isStepSuccess: succeeded('a', 'b'),
        isStepBypassed: succeeded('c'),
      }),
    ).toBeUndefined();
  });

  it('picks nothing for an empty graph', () => {
    expect(
      selectNextStepKey({ stepNodesInOrder: [], isStepSuccess: succeeded(), isStepBypassed: succeeded() }),
    ).toBeUndefined();
  });
});

describe('isLastRunnableStep', () => {
  const order = ['a', 'b', 'c'];

  it('says so when nothing after it still needs to run', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: 'b',
        stepNodesInOrder: order,
        isStepSuccess: succeeded('c'),
        isStepBypassed: succeeded(),
      }),
    ).toBe(true);
  });

  it('counts a bypassed later step as accounted for', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: 'b',
        stepNodesInOrder: order,
        isStepSuccess: succeeded(),
        isStepBypassed: succeeded('c'),
      }),
    ).toBe(true);
  });

  it('says no while a later step still has to run', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: 'a',
        stepNodesInOrder: order,
        isStepSuccess: succeeded('b'),
        isStepBypassed: succeeded(),
      }),
    ).toBe(false);
  });

  it('treats the final step in the graph as the last runnable one', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: 'c',
        stepNodesInOrder: order,
        isStepSuccess: succeeded(),
        isStepBypassed: succeeded(),
      }),
    ).toBe(true);
  });

  it('says no when there is no next step at all', () => {
    expect(
      isLastRunnableStep({
        nextStepKey: undefined,
        stepNodesInOrder: order,
        isStepSuccess: succeeded(),
        isStepBypassed: succeeded(),
      }),
    ).toBe(false);
  });
});

describe('allPredecessorsResolved', () => {
  it('resolves when every predecessor succeeded', () => {
    expect(allPredecessorsResolved(['a', 'b'], { a: { status: 'success' }, b: { status: 'success' } })).toBe(true);
  });

  it('does not resolve while one predecessor is still running', () => {
    expect(allPredecessorsResolved(['a', 'b'], { a: { status: 'success' }, b: { status: 'running' } })).toBe(false);
  });

  it('does not resolve when a predecessor has no record at all', () => {
    expect(allPredecessorsResolved(['a', 'b'], { a: { status: 'success' } })).toBe(false);
  });

  it('counts a bypassed dead arm as resolved', () => {
    expect(allPredecessorsResolved(['a', 'b'], { a: { status: 'success' } }, id => id === 'b')).toBe(true);
  });

  it('does not resolve when there are no step records at all', () => {
    expect(allPredecessorsResolved(['a'], undefined)).toBe(false);
  });

  it('resolves vacuously for a step with no predecessors', () => {
    expect(allPredecessorsResolved([], undefined)).toBe(true);
  });

  it('treats nothing as bypassed unless the caller says so', () => {
    expect(allPredecessorsResolved(['a'], { a: { status: 'running' } })).toBe(false);
  });
});

describe('findFocusNode', () => {
  const node = (data: Record<string, unknown>): Node =>
    ({ id: String(data.stepId ?? data.label), position: { x: 0, y: 0 }, data }) as Node;

  it('finds a step node by the step id it carries', () => {
    const nodes = [node({ stepId: 'a' }), node({ stepId: 'b' })];

    expect(findFocusNode(nodes, 'b')?.data.stepId).toBe('b');
  });

  it('falls back to the label for a condition node, which carries no step id', () => {
    const nodes = [node({ label: 'is-ready' })];

    expect(findFocusNode(nodes, 'is-ready')?.data.label).toBe('is-ready');
  });

  it('prefers the step id over the label when a node has both', () => {
    const nodes = [node({ stepId: 'a', label: 'b' })];

    expect(findFocusNode(nodes, 'a')).toBeDefined();
    expect(findFocusNode(nodes, 'b')).toBeUndefined();
  });

  it('finds nothing before the graph has been laid out', () => {
    expect(findFocusNode([], 'a')).toBeUndefined();
  });
});

describe('buildNextStepInput', () => {
  describe('when the step has a single predecessor', () => {
    it('forwards that step output directly', () => {
      expect(
        buildNextStepInput({
          nextStepKey: 'b',
          stepsFlow: { b: ['a'] },
          steps: { a: { status: 'success', output: { total: 3 } } },
        }),
      ).toEqual({ hasMultiSteps: false, input: { total: 3 } });
    });

    it('builds nothing while that predecessor is still running', () => {
      expect(
        buildNextStepInput({ nextStepKey: 'b', stepsFlow: { b: ['a'] }, steps: { a: { status: 'running' } } }),
      ).toBeUndefined();
    });
  });

  describe('when the step joins several predecessors', () => {
    it('keys each predecessor output by the step it came from', () => {
      expect(
        buildNextStepInput({
          nextStepKey: 'join',
          stepsFlow: { join: ['a', 'b'] },
          steps: { a: { status: 'success', output: 1 }, b: { status: 'success', output: 2 } },
        }),
      ).toEqual({ hasMultiSteps: true, input: { a: 1, b: 2 } });
    });

    it('builds nothing while one arm is still running, rather than a partial map', () => {
      // A partial map would wrongly enable "Run next step" on a paused
      // parallel join where only one arm has finished.
      expect(
        buildNextStepInput({
          nextStepKey: 'join',
          stepsFlow: { join: ['a', 'b'] },
          steps: { a: { status: 'success', output: 1 }, b: { status: 'running' } },
        }),
      ).toBeUndefined();
    });

    it('leaves a bypassed dead arm out of the map', () => {
      expect(
        buildNextStepInput({
          nextStepKey: 'join',
          stepsFlow: { join: ['a', 'b'] },
          steps: { a: { status: 'success', output: 1 } },
          isStepBypassed: id => id === 'b',
        }),
      ).toEqual({ hasMultiSteps: true, input: { a: 1 } });
    });
  });

  describe('when there is nothing to build from', () => {
    it('builds nothing without a next step', () => {
      expect(buildNextStepInput({ nextStepKey: undefined, stepsFlow: {}, steps: {} })).toBeUndefined();
    });

    it('builds nothing for a step that starts the graph', () => {
      expect(buildNextStepInput({ nextStepKey: 'a', stepsFlow: {}, steps: {} })).toBeUndefined();
    });

    it('builds nothing when the step records are missing entirely', () => {
      expect(buildNextStepInput({ nextStepKey: 'b', stepsFlow: { b: ['a'] }, steps: undefined })).toBeUndefined();
    });
  });
});
