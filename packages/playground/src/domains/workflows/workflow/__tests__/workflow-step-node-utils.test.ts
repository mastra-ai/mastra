import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { describe, expect, it } from 'vitest';
import { constructNodesAndEdges } from '../utils';
import {
  resolveWorkflowGraphStep,
  WORKFLOW_BOUNDARY_NODE_TYPE,
  WORKFLOW_STEP_NODE_TYPE,
} from '../workflow-step-node-utils';

const step = (id: string) => ({ id, description: `${id} description` });
const stepEntry = (id: string): SerializedStepFlowEntry => ({ type: 'step', step: step(id) });

describe('resolveWorkflowGraphStep', () => {
  it.each([
    [stepEntry('regular'), 'step'],
    [{ type: 'step', step: { ...step('map'), mapConfig: 'return input' } }, 'map-step'],
    [{ type: 'agent', id: 'writer', agentId: 'writer-agent' }, 'agent-step'],
    [{ type: 'tool', id: 'double', toolId: 'double-tool' }, 'tool-step'],
    [{ type: 'mapping', id: 'map-1', mapConfig: 'return input' }, 'map-step'],
    [{ type: 'foreach', step: stepEntry('each'), opts: { concurrency: 2 } }, 'foreach-step'],
    [{ type: 'parallel', steps: [stepEntry('a')] }, 'parallel-step'],
    [
      {
        type: 'conditional',
        steps: [stepEntry('when-true')],
        serializedConditions: [{ id: 'condition-1', fn: 'true' }],
      },
      'conditional',
    ],
    [
      {
        type: 'loop',
        step: stepEntry('loop'),
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
        step: {
          ...step('nested'),
          component: 'WORKFLOW',
          serializedStepFlow: [stepEntry('child')],
        },
      },
      'nested-workflow-step',
    ],
    [
      {
        type: 'workflow',
        id: 'nested-wf',
        workflowId: 'nested-wf',
        serializedStepFlow: [stepEntry('child')],
      },
      'nested-workflow-step',
    ],
  ] as [SerializedStepFlowEntry, string][])('maps %s to %s', (flow, kind) => {
    expect(resolveWorkflowGraphStep(flow).kind).toBe(kind);
  });

  it('exposes the declarative ids on resolved agent / tool / mapping steps', () => {
    const agent = resolveWorkflowGraphStep({ type: 'agent', id: 'writer', agentId: 'writer-agent' });
    expect(agent.kind).toBe('agent-step');
    expect(agent.id).toBe('writer');
    expect((agent.flow as Extract<SerializedStepFlowEntry, { type: 'agent' }>).agentId).toBe('writer-agent');

    const tool = resolveWorkflowGraphStep({ type: 'tool', id: 'double', toolId: 'double-tool' });
    expect(tool.kind).toBe('tool-step');
    expect((tool.flow as Extract<SerializedStepFlowEntry, { type: 'tool' }>).toolId).toBe('double-tool');
  });

  it('resolves agent / tool children nested in a parallel entry', () => {
    const parallel: SerializedStepFlowEntry = {
      type: 'parallel',
      steps: [
        { type: 'agent', id: 'a', agentId: 'a-agent' },
        { type: 'tool', id: 't', toolId: 't-tool' },
      ],
    };
    const children = (parallel as Extract<SerializedStepFlowEntry, { type: 'parallel' }>).steps.map(
      child => resolveWorkflowGraphStep(child).kind,
    );
    expect(children).toEqual(['agent-step', 'tool-step']);
  });

  it('builds graph nodes for declarative agent / tool / mapping entries', () => {
    const { nodes } = constructNodesAndEdges({
      stepGraph: [
        { type: 'agent', id: 'writer', agentId: 'writer-agent' },
        { type: 'tool', id: 'double', toolId: 'double-tool' },
        { type: 'mapping', id: 'map-1', mapConfig: 'return input' },
      ],
    });

    const stepNodes = nodes.filter(node => node.type === WORKFLOW_STEP_NODE_TYPE);
    expect(stepNodes.map(node => node.data.workflowStep.kind)).toEqual(['agent-step', 'tool-step', 'map-step']);
  });

  it('builds graph nodes for type:workflow entries and attaches nested stepGraph', () => {
    const nestedFlow: SerializedStepFlowEntry[] = [
      stepEntry('child-a'),
      { type: 'tool', id: 'child-tool', toolId: 'echo' },
    ];
    const { nodes } = constructNodesAndEdges({
      stepGraph: [
        {
          type: 'workflow',
          id: 'sub-wf',
          workflowId: 'sub-wf',
          description: 'nested digest',
          serializedStepFlow: nestedFlow,
        },
      ],
    });

    const stepNodes = nodes.filter(
      node => node.type === WORKFLOW_STEP_NODE_TYPE && !('nodeRole' in node.data && node.data.nodeRole === 'condition'),
    );
    expect(stepNodes).toHaveLength(1);
    expect(stepNodes[0].id).toBe('node-sub-wf');
    const data = stepNodes[0].data as {
      stepId?: string;
      workflowStep: { kind: string };
      stepGraph?: SerializedStepFlowEntry[];
      description?: string;
    };
    expect(data.stepId).toBe('sub-wf');
    expect(data.workflowStep.kind).toBe('nested-workflow-step');
    expect(data.stepGraph).toEqual(nestedFlow);
    expect(data.description).toBe('nested digest');
  });

  it('attaches nested stepGraph when type:workflow sits inside a conditional branch', () => {
    const nestedFlow: SerializedStepFlowEntry[] = [stepEntry('branch-child')];
    const { nodes } = constructNodesAndEdges({
      stepGraph: [
        {
          type: 'conditional',
          steps: [
            {
              type: 'workflow',
              id: 'escalation-branch',
              workflowId: 'daily-standup-with-escalation',
              serializedStepFlow: nestedFlow,
            },
          ],
          serializedConditions: [{ id: 'has-blockers', fn: 'stepResults.detect-blockers.hasBlockers' }],
        },
      ] as SerializedStepFlowEntry[],
    });

    const stepNodes = nodes.filter(
      node => node.type === WORKFLOW_STEP_NODE_TYPE && !('nodeRole' in node.data && node.data.nodeRole === 'condition'),
    );
    expect(stepNodes).toHaveLength(1);
    const data = stepNodes[0].data as {
      workflowStep: { kind: string };
      stepGraph?: SerializedStepFlowEntry[];
    };
    expect(data.workflowStep.kind).toBe('nested-workflow-step');
    expect(data.stepGraph).toEqual(nestedFlow);
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

  it('surfaces predicate-derived labels on conditional branch condition nodes', () => {
    // Simulate what the fluent builder writes for a `.branch({ predicate })`
    // call: `serializedConditions[i].fn` holds the derivePredicateLabel output.
    const { nodes } = constructNodesAndEdges({
      stepGraph: [
        {
          type: 'conditional',
          steps: [
            { type: 'step', step: step('high') },
            { type: 'step', step: step('low') },
          ],
          serializedConditions: [
            { id: 'high-branch', fn: 'inputData.value > 10' },
            { id: 'low-branch', fn: 'inputData.value <= 10' },
          ],
        },
      ] as unknown as SerializedStepFlowEntry[],
    });

    const conditionNodes = nodes.filter(
      (node): node is Extract<typeof node, { type: typeof WORKFLOW_STEP_NODE_TYPE }> =>
        node.type === WORKFLOW_STEP_NODE_TYPE && node.data.nodeRole === 'condition',
    );
    expect(conditionNodes).toHaveLength(2);
    expect(conditionNodes[0].data.conditions).toEqual([{ type: 'when', fnString: 'inputData.value > 10' }]);
    expect(conditionNodes[1].data.conditions).toEqual([{ type: 'when', fnString: 'inputData.value <= 10' }]);
  });

  it('surfaces predicate-derived labels on loop condition nodes', () => {
    // Simulate what the fluent builder writes for `.dountil({ predicate })`:
    // `serializedCondition.fn` holds the derivePredicateLabel output, and
    // loopType flows through to the condition-node label.
    const { nodes } = constructNodesAndEdges({
      stepGraph: [
        {
          type: 'loop',
          step: step('increment'),
          serializedCondition: { id: 'stop-when-three', fn: 'inputData.count >= 3' },
          loopType: 'dountil',
        },
      ] as unknown as SerializedStepFlowEntry[],
    });

    const conditionNodes = nodes.filter(
      (node): node is Extract<typeof node, { type: typeof WORKFLOW_STEP_NODE_TYPE }> =>
        node.type === WORKFLOW_STEP_NODE_TYPE && node.data.nodeRole === 'condition',
    );
    expect(conditionNodes).toHaveLength(1);
    expect(conditionNodes[0].data.conditions).toEqual([{ type: 'dountil', fnString: 'inputData.count >= 3' }]);
  });
});
