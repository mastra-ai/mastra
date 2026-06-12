import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { constructNodesAndEdges } from '../utils';
import { resolveWorkflowGraphStep } from '../workflow-step-node-utils';

const step = (id: string) => ({ id, description: `${id} description` });

describe('resolveWorkflowGraphStep', () => {
  it.each([
    [{ type: 'step', step: step('regular') }, 'step'],
    [{ type: 'step', step: { ...step('map'), mapConfig: 'return input' } }, 'map-step'],
    [{ type: 'foreach', step: step('each'), opts: { concurrency: 2 } }, 'foreach-step'],
    [{ type: 'parallel', steps: [{ type: 'step', step: step('a') }] }, 'parallel-step'],
    [
      {
        type: 'conditional',
        steps: [{ type: 'step', step: step('when-true') }],
        serializedConditions: [{ id: 'condition-1', fn: 'true' }],
      },
      'conditional',
    ],
    [
      {
        type: 'loop',
        step: step('loop'),
        serializedCondition: { id: 'loop-condition', fn: 'true' },
        loopType: 'dountil',
      },
      'loop-step',
    ],
    [{ type: 'sleep', id: 'sleep', duration: 1000 }, 'sleep-step'],
    [{ type: 'sleepUntil', id: 'sleep-until', date: new Date(0) }, 'sleep-until-step'],
    [
      {
        type: 'step',
        step: { ...step('nested'), component: 'WORKFLOW', serializedStepFlow: [{ type: 'step', step: step('child') }] },
      },
      'nested-workflow-step',
    ],
  ] satisfies [SerializedStepFlowEntry, string][])('maps %s to %s', (flow, kind) => {
    expect(resolveWorkflowGraphStep(flow).kind).toBe(kind);
  });

  it('keeps workflow graph nodes on one React Flow node type with resolved step data', () => {
    const { nodes } = constructNodesAndEdges({
      stepGraph: [
        { type: 'step', step: step('regular') },
        { type: 'step', step: { ...step('map'), mapConfig: 'return input' } },
        { type: 'sleep', id: 'sleep', duration: 1000 },
      ],
    });

    expect(nodes).toHaveLength(3);
    expect(nodes.map(node => node.type)).toEqual(['workflow-step-node', 'workflow-step-node', 'workflow-step-node']);
    expect(nodes.map(node => node.data.workflowStep.kind)).toEqual(['step', 'map-step', 'sleep-step']);
  });
});
