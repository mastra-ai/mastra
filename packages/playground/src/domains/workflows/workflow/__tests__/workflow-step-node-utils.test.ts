import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { constructNodesAndEdges } from '../utils';
import {
  resolveWorkflowGraphStep,
  WORKFLOW_BOUNDARY_NODE_TYPE,
  WORKFLOW_STEP_NODE_TYPE,
} from '../workflow-step-node-utils';

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
    const { nodes, edges } = constructNodesAndEdges({
      stepGraph: [
        { type: 'step', step: step('regular') },
        { type: 'step', step: { ...step('map'), mapConfig: 'return input' } },
        { type: 'sleep', id: 'sleep', duration: 1000 },
      ],
    });

    const stepNodes = nodes.filter(node => node.type === WORKFLOW_STEP_NODE_TYPE);

    expect(nodes).toHaveLength(5);
    expect(nodes[0].id).toBe('boundary-start');
    expect(nodes[0].type).toBe(WORKFLOW_BOUNDARY_NODE_TYPE);
    expect(nodes[0].data.label).toBe('Start');
    expect(nodes.at(-1)?.id).toBe('boundary-end');
    expect(nodes.at(-1)?.type).toBe(WORKFLOW_BOUNDARY_NODE_TYPE);
    expect(nodes.at(-1)?.data.label).toBe('End');
    expect(stepNodes).toHaveLength(3);
    expect(stepNodes.map(node => node.id)).toEqual(['node-regular', 'node-map', 'node-sleep']);
    expect(stepNodes.map(node => node.data.stepId)).toEqual(['regular', 'map', 'sleep']);
    expect(stepNodes.map(node => node.data.workflowStep.kind)).toEqual(['step', 'map-step', 'sleep-step']);
    expect(stepNodes[0].data.withoutTopHandle).toBe(false);
    expect(stepNodes.at(-1)?.data.withoutBottomHandle).toBe(false);
    expect(
      edges.some(
        edge =>
          edge.id === 'edge-boundary-boundary-start-node-regular' &&
          edge.source === 'boundary-start' &&
          edge.target === 'node-regular' &&
          edge.data?.nextStepId === 'regular',
      ),
    ).toBe(true);
    expect(
      edges.some(
        edge =>
          edge.id === 'edge-boundary-node-sleep-boundary-end' &&
          edge.source === 'node-sleep' &&
          edge.target === 'boundary-end',
      ),
    ).toBe(true);
  });

  it('namespaces graph IDs by domain while preserving raw workflow metadata', () => {
    const { nodes, edges } = constructNodesAndEdges({
      stepGraph: [
        { type: 'step', step: step('shared') },
        {
          type: 'conditional',
          steps: [{ type: 'step', step: step('shared') }],
          serializedConditions: [{ id: 'shared', fn: 'input.value === true' }],
        },
      ],
    });

    const nodeIds = nodes.map(node => node.id);
    const edgeIds = edges.map(edge => edge.id);
    const stepNodes = nodes.filter(node => node.type === WORKFLOW_STEP_NODE_TYPE && node.data.nodeRole !== 'condition');
    const conditionNodes = nodes.filter(
      node => node.type === WORKFLOW_STEP_NODE_TYPE && node.data.nodeRole === 'condition',
    );

    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
    expect(stepNodes.every(node => node.id.startsWith('node-'))).toBe(true);
    expect(conditionNodes.every(node => node.id.startsWith('condition-node-'))).toBe(true);
    expect(edges.every(edge => edge.id.startsWith('edge-'))).toBe(true);
    expect(nodeIds).toContain('node-shared');
    expect(nodeIds).toContain('node-shared-1');
    expect(nodeIds).toContain('condition-node-shared');
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'node-shared',
          target: 'condition-node-shared',
          data: expect.objectContaining({ previousStepId: 'shared', nextStepId: 'shared' }),
        }),
        expect.objectContaining({
          source: 'condition-node-shared',
          target: 'node-shared-1',
          data: expect.objectContaining({ previousStepId: 'shared', nextStepId: 'shared' }),
        }),
      ]),
    );
  });
});
