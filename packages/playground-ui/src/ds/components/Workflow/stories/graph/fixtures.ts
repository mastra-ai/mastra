import type { Edge, Node } from '@xyflow/react';
import type { WorkflowDataEdgeData } from '../../graph/types';
import { WORKFLOW_BOUNDARY_NODE_TYPE, WORKFLOW_DATA_EDGE_TYPE } from '../../graph/types';
import type { WorkflowCardCondition, WorkflowStepCardViewProps } from '../../types';

export type StoryStepNode = Node<{ card: WorkflowStepCardViewProps; nested?: boolean }, 'step'>;
export type StoryConditionNode = Node<{ conditions: WorkflowCardCondition[] }, 'condition'>;
export type StoryDataEdge = Edge<WorkflowDataEdgeData & { output?: unknown }, typeof WORKFLOW_DATA_EDGE_TYPE>;

const start = {
  id: 'start',
  type: WORKFLOW_BOUNDARY_NODE_TYPE,
  position: { x: 109, y: 0 },
  data: { boundaryRole: 'start', label: 'Start' },
};
const end = {
  id: 'end',
  type: WORKFLOW_BOUNDARY_NODE_TYPE,
  position: { x: 109, y: 600 },
  data: { boundaryRole: 'end', label: 'End' },
};

function step(
  id: string,
  label: string,
  x: number,
  y: number,
  props: Partial<WorkflowStepCardViewProps> & { nested?: boolean } = {},
): StoryStepNode {
  return {
    id,
    type: 'step',
    position: { x, y },
    data: { card: { label, stepKey: id, ...props }, nested: props.nested },
  };
}

function edge(source: string, target: string, output?: unknown): StoryDataEdge {
  return {
    id: `${source}-${target}`,
    type: WORKFLOW_DATA_EDGE_TYPE,
    source,
    target,
    animated: output === undefined,
    style: { stroke: output === undefined ? '#8e8e8e' : '#22c55e' },
    data: { previousStepId: source, nextStepId: target, edgeStatus: output === undefined ? 'idle' : 'success', output },
  };
}

export const sequentialNodes: Node[] = [
  start,
  step('fetch', 'Fetch customer', 0, 140, { displayStatus: 'success', startedAt: 1000, endedAt: 1120 }),
  step('enrich', 'Enrich profile', 0, 300, { displayStatus: 'running' }),
  step('save', 'Save customer', 0, 460),
  end,
];
export const sequentialEdges = [
  edge('start', 'fetch', { customerId: 'customer-42' }),
  edge('fetch', 'enrich', { name: 'Ada' }),
  edge('enrich', 'save'),
  edge('save', 'end'),
];

export const branchNodes: Node[] = [
  start,
  {
    id: 'condition',
    type: 'condition',
    position: { x: 0, y: 140 },
    data: { conditions: [{ type: 'if', fnString: 'input.total > 100' }] },
  } satisfies StoryConditionNode,
  step('approve', 'Approve order', -170, 320, { displayStatus: 'success' }),
  step('review', 'Manual review', 170, 320, { displayStatus: 'skipped' }),
  step('notify', 'Send notification', 0, 460, { displayStatus: 'running' }),
  end,
];
export const branchEdges = [
  edge('start', 'condition', { total: 125 }),
  edge('condition', 'approve', { approved: true }),
  edge('condition', 'review'),
  edge('approve', 'notify', { approved: true }),
  edge('review', 'notify'),
  edge('notify', 'end'),
];

export const parallelNodes: Node[] = [
  start,
  step('orders', 'Load orders', -170, 180, { isParallel: true, displayStatus: 'success' }),
  step('tickets', 'Load support tickets', 170, 180, { isParallel: true, displayStatus: 'running' }),
  step('merge', 'Combine results', 0, 400, { mapConfig: 'return { ...orders, ...tickets }' }),
  end,
];
export const parallelEdges = [
  edge('start', 'orders', { customerId: 'customer-42' }),
  edge('start', 'tickets', { customerId: 'customer-42' }),
  edge('orders', 'merge', { orders: 3 }),
  edge('tickets', 'merge'),
  edge('merge', 'end'),
];

export const loopNodes: Node[] = [
  start,
  step('enrich', 'Enrich each customer', 0, 160, {
    isForEach: true,
    displayStatus: 'running',
    foreachProgress: { completedCount: 2, totalCount: 5, iterationStatus: 'success' },
  }),
  {
    id: 'until',
    type: 'condition',
    position: { x: 0, y: 350 },
    data: { conditions: [{ type: 'dountil', fnString: 'output.remaining === 0' }] },
  } satisfies StoryConditionNode,
  end,
];
export const loopEdges = [edge('start', 'enrich', { customers: 5 }), edge('enrich', 'until'), edge('until', 'end')];

export const nestedNodes: Node[] = [
  start,
  step('nested', 'Customer enrichment', 0, 220, {
    nested: true,
    isNestedWorkflowStep: true,
    stepGraph: [],
    displayStatus: 'running',
  }),
  end,
];
export const nestedEdges = [edge('start', 'nested', { customerId: 'customer-42' }), edge('nested', 'end')];
