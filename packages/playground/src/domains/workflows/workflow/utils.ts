import Dagre from '@dagrejs/dagre';
import type { Workflow, SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { WorkflowDataEdgeModel } from './workflow-data-edge';
import {
  resolveWorkflowGraphStep,
  WORKFLOW_BOUNDARY_NODE_TYPE,
  WORKFLOW_STEP_NODE_TYPE,
} from './workflow-step-node-utils';
import type { WorkflowBoundaryNode, WorkflowStepNode } from './workflow-step-node-utils';

const getWorkflowBoundaryNodeId = (role: 'start' | 'end') => `boundary-${role}`;
const WORKFLOW_START_NODE_ID = getWorkflowBoundaryNodeId('start');
const WORKFLOW_END_NODE_ID = getWorkflowBoundaryNodeId('end');

const getWorkflowNodeId = (stepId: string) => `node-${stepId}`;
const getWorkflowConditionNodeId = (conditionId: string) => `condition-node-${conditionId}`;
const getWorkflowEdgeId = (source: string, target: string, domain = 'step') => `edge-${domain}-${source}-${target}`;

export type WorkflowGraphNode = WorkflowStepNode | WorkflowBoundaryNode;
export type WorkflowGraphEdge = WorkflowDataEdgeModel;

const normalizeDuplicateEdgeIds = (edges: WorkflowGraphEdge[]): WorkflowGraphEdge[] => {
  const usedEdgeIds = new Set<string>();

  return edges.map(edge => {
    if (!usedEdgeIds.has(edge.id)) {
      usedEdgeIds.add(edge.id);
      return edge;
    }

    let suffix = 1;
    let nextId = `${edge.id}-${suffix}`;
    while (usedEdgeIds.has(nextId)) {
      suffix += 1;
      nextId = `${edge.id}-${suffix}`;
    }
    usedEdgeIds.add(nextId);

    return {
      ...edge,
      id: nextId,
    };
  });
};

const getNodeSize = (node: WorkflowGraphNode): { width: number; height: number } => {
  if (node.type === WORKFLOW_BOUNDARY_NODE_TYPE) {
    return {
      width: node.measured?.width ?? 56,
      height: node.measured?.height ?? 56,
    };
  }

  return {
    width: node.measured?.width ?? 274,
    height: node.measured?.height ?? (node?.data?.isLarge ? 260 : 100),
  };
};

export type ConditionConditionType = 'if' | 'else' | 'when' | 'until' | 'while' | 'dountil' | 'dowhile';

export type Condition =
  | {
      type: ConditionConditionType;
      ref: {
        step:
          | {
              id: string;
            }
          | 'trigger';
        path: string;
      };
      query: Record<string, any>;
      conj?: 'and' | 'or' | 'not';
      fnString?: never;
    }
  | {
      type: ConditionConditionType;
      fnString: string;
      ref?: never;
      query?: never;
      conj?: never;
    };

const formatMappingLabel = (stepId: string, prevStepIds: string[], nextStepIds: string[]): string => {
  // If not a mapping node, return original ID
  if (!stepId.startsWith('mapping_')) {
    return stepId;
  }

  const capitalizeWords = (str: string) => {
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatStepName = (id: string) => {
    // Remove common prefixes and clean up
    const cleaned = id.replace(/Step$/, '').replace(/[-_]/g, ' ').trim();
    return capitalizeWords(cleaned);
  };

  const formatMultipleSteps = (ids: string[], isTarget: boolean) => {
    if (ids.length === 0) return isTarget ? 'End' : 'Start';
    if (ids.length === 1) return formatStepName(ids[0]);
    return `${ids.length} Steps`;
  };

  const fromLabel = formatMultipleSteps(prevStepIds, false);
  const toLabel = formatMultipleSteps(nextStepIds, true);

  return `${fromLabel} → ${toLabel} Map`;
};

const getLayoutedElements = (nodes: WorkflowGraphNode[], edges: WorkflowGraphEdge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB' });

  edges.forEach(edge => g.setEdge(edge.source, edge.target));
  nodes.forEach(node =>
    g.setNode(node.id, {
      ...node,
      ...getNodeSize(node),
    }),
  );

  Dagre.layout(g);

  const fullWidth = g.graph()?.width ? g.graph().width! / 2 : 0;
  const fullHeight = g.graph()?.height ? g.graph().height! / 2 : 0;

  return {
    nodes: nodes.map(node => {
      const position = g.node(node.id);
      const { width, height } = getNodeSize(node);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const positionX = position.x - width / 2;
      const positionY = position.y - height / 2;
      const x = positionX;
      const y = positionY;

      return { ...node, position: { x, y } };
    }),
    edges,
    fullWidth,
    fullHeight,
  };
};

const defaultEdgeOptions = {
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: '#8e8e8e',
  },
};

const conditionWorkflowStep = (condition: { id: string; fn: string }) =>
  resolveWorkflowGraphStep({
    type: 'conditional',
    steps: [],
    serializedConditions: [condition],
  });

export type WStep = {
  [key: string]: {
    id: string;
    description: string;
    workflowId?: string;
    stepGraph?: any;
    stepSubscriberGraph?: any;
  };
};

/** Resolves the id of a single step-like serialized entry (step / agent / tool / mapping). */
const getSingleStepFlowId = (flow: SerializedStepFlowEntry): string => {
  if ('id' in flow) return flow.id;
  if ('step' in flow) {
    const inner = flow.step;
    if ('id' in inner) return inner.id;
    if ('step' in inner) return inner.step.id;
  }
  return '';
};

type SerializedStepInner = Extract<SerializedStepFlowEntry, { type: 'step' }>['step'];
type SerializedStepLike = Pick<SerializedStepInner, 'id' | 'description' | 'component'> &
  Partial<Pick<SerializedStepInner, 'serializedStepFlow' | 'mapConfig' | 'canSuspend' | 'metadata'>>;

/**
 * `foreach.step` widened to `SerializedSingleStepEntry` (agent | tool | step | mapping).
 * For the `type: 'step'` variant, forward the wrapped step directly; for
 * agent/tool/mapping variants, synthesize an id-only shim so downstream reads
 * (`.id`, `.description`, `.component`, ...) don't blow up.
 */
const unwrapForeachInner = (
  inner: Extract<SerializedStepFlowEntry, { type: 'foreach' }>['step'],
): SerializedStepLike => {
  if (inner.type === 'step') return inner.step;
  if (inner.type === 'workflow') {
    return { id: inner.id, description: undefined, component: 'WORKFLOW' };
  }
  return { id: inner.id, description: undefined, component: undefined };
};

const getStepNodeAndEdge = ({
  stepFlow,
  xIndex,
  yIndex,
  prevNodeIds,
  prevStepIds,
  nextStepFlow,
  condition,
  allPrevNodeIds,
}: {
  stepFlow: SerializedStepFlowEntry;
  xIndex: number;
  yIndex: number;
  prevNodeIds: string[];
  prevStepIds: string[];
  nextStepFlow?: SerializedStepFlowEntry;
  condition?: { id: string; fn: string };
  allPrevNodeIds: Set<string>;
}): { nodes: WorkflowStepNode[]; edges: WorkflowGraphEdge[]; nextPrevNodeIds: string[]; nextPrevStepIds: string[] } => {
  let nextNodeIds: string[] = [];
  let nextStepIds: string[] = [];
  if (nextStepFlow?.type === 'step' || nextStepFlow?.type === 'foreach' || nextStepFlow?.type === 'loop') {
    const nextInner = nextStepFlow.type === 'foreach' ? unwrapForeachInner(nextStepFlow.step) : nextStepFlow.step;
    const nextStepId = allPrevNodeIds.has(getWorkflowNodeId(nextInner.id))
      ? `${nextInner.id}-${yIndex + 1}`
      : nextInner.id;
    nextNodeIds = [getWorkflowNodeId(nextStepId)];
    nextStepIds = [nextInner.id];
  }
  if (
    nextStepFlow?.type === 'sleep' ||
    nextStepFlow?.type === 'sleepUntil' ||
    nextStepFlow?.type === 'agent' ||
    nextStepFlow?.type === 'tool' ||
    nextStepFlow?.type === 'mapping'
  ) {
    const nextStepId = allPrevNodeIds.has(getWorkflowNodeId(nextStepFlow.id))
      ? `${nextStepFlow.id}-${yIndex + 1}`
      : nextStepFlow.id;
    nextNodeIds = [getWorkflowNodeId(nextStepId)];
    nextStepIds = [nextStepFlow.id];
  }
  if (nextStepFlow?.type === 'parallel') {
    nextNodeIds =
      nextStepFlow?.steps.map(step => {
        const stepId = getSingleStepFlowId(step);
        const nextStepId = allPrevNodeIds.has(getWorkflowNodeId(stepId)) ? `${stepId}-${yIndex + 1}` : stepId;
        return getWorkflowNodeId(nextStepId);
      }) || [];
    nextStepIds = nextStepFlow?.steps.map(step => getSingleStepFlowId(step)) || [];
  }
  if (nextStepFlow?.type === 'conditional') {
    nextNodeIds = nextStepFlow?.serializedConditions.map(cond => getWorkflowConditionNodeId(cond.id)) || [];
    nextStepIds = nextStepFlow?.steps?.map(step => getSingleStepFlowId(step)) || [];
  }

  if (stepFlow.type === 'step' || stepFlow.type === 'foreach') {
    const innerStep = stepFlow.type === 'foreach' ? unwrapForeachInner(stepFlow.step) : stepFlow.step;
    const hasGraph = innerStep.component === 'WORKFLOW';
    const rawNodeId = allPrevNodeIds.has(getWorkflowNodeId(innerStep.id)) ? `${innerStep.id}-${yIndex}` : innerStep.id;
    const nodeId = getWorkflowNodeId(rawNodeId);
    const conditionNodes: WorkflowStepNode[] = condition
      ? [
          {
            id: getWorkflowConditionNodeId(condition.id),
            position: { x: xIndex * 300, y: yIndex * 100 },
            type: WORKFLOW_STEP_NODE_TYPE,
            data: {
              label: condition.id,
              workflowStep: conditionWorkflowStep(condition),
              nodeRole: 'condition',
              previousStepId: prevStepIds[prevStepIds.length - 1],
              nextStepId: innerStep.id,
              withoutTopHandle: !prevNodeIds.length,
              withoutBottomHandle: !nextNodeIds.length,
              isLarge: true,
              conditions: [{ type: 'when', fnString: condition.fn }],
            },
          },
        ]
      : [];
    const nodes: WorkflowStepNode[] = [
      ...conditionNodes,
      {
        id: nodeId,
        position: { x: xIndex * 300, y: (yIndex + (condition ? 1 : 0)) * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: formatMappingLabel(innerStep.id, prevStepIds, nextStepIds),
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          stepId: innerStep.id,
          description: innerStep.description,
          withoutTopHandle: condition ? false : !prevNodeIds.length,
          withoutBottomHandle: !nextNodeIds.length,
          stepGraph: hasGraph ? innerStep.serializedStepFlow : undefined,
          mapConfig: innerStep.mapConfig,
          canSuspend: innerStep.canSuspend,
          isForEach: stepFlow.type === 'foreach',
          metadata: innerStep.metadata,
        },
      },
    ];
    const edges: WorkflowGraphEdge[] = [
      ...(condition
        ? [
            ...(prevNodeIds || []).map((prevNodeId, i) => ({
              id: getWorkflowEdgeId(prevNodeId, getWorkflowConditionNodeId(condition.id), 'condition'),
              source: prevNodeId,
              data: { previousStepId: prevStepIds[i], nextStepId: innerStep.id, conditionNode: true },
              target: getWorkflowConditionNodeId(condition.id),
              ...defaultEdgeOptions,
            })),
            {
              id: getWorkflowEdgeId(getWorkflowConditionNodeId(condition.id), nodeId, 'condition'),
              source: getWorkflowConditionNodeId(condition.id),
              data: {
                previousStepId: prevStepIds[prevStepIds.length - 1],
                nextStepId: innerStep.id,
                conditionNode: true,
              },
              target: nodeId,
              ...defaultEdgeOptions,
            },
          ]
        : (prevNodeIds || []).map((prevNodeId, i) => ({
            id: getWorkflowEdgeId(prevNodeId, nodeId),
            source: prevNodeId,
            data: { previousStepId: prevStepIds[i], nextStepId: innerStep.id },
            target: nodeId,
            ...defaultEdgeOptions,
          }))),
      ...(nextNodeIds || []).map((nextNodeId, i) => ({
        id: getWorkflowEdgeId(nodeId, nextNodeId),
        source: nodeId,
        data: { previousStepId: innerStep.id, nextStepId: nextStepIds[i] },
        target: nextNodeId,
        ...defaultEdgeOptions,
      })),
    ];
    return { nodes, edges, nextPrevNodeIds: [nodeId], nextPrevStepIds: [innerStep.id] };
  }

  if (stepFlow.type === 'agent' || stepFlow.type === 'tool' || stepFlow.type === 'mapping') {
    const stepId = stepFlow.id;
    const rawNodeId = allPrevNodeIds.has(getWorkflowNodeId(stepId)) ? `${stepId}-${yIndex}` : stepId;
    const nodeId = getWorkflowNodeId(rawNodeId);
    const description = stepFlow.type === 'mapping' ? undefined : stepFlow.description;
    const label = stepFlow.type === 'mapping' ? formatMappingLabel(stepId, prevStepIds, nextStepIds) : stepId;
    const conditionNodes: WorkflowStepNode[] = condition
      ? [
          {
            id: getWorkflowConditionNodeId(condition.id),
            position: { x: xIndex * 300, y: yIndex * 100 },
            type: WORKFLOW_STEP_NODE_TYPE,
            data: {
              label: condition.id,
              workflowStep: conditionWorkflowStep(condition),
              nodeRole: 'condition',
              previousStepId: prevStepIds[prevStepIds.length - 1],
              nextStepId: stepId,
              withoutTopHandle: !prevNodeIds.length,
              withoutBottomHandle: !nextNodeIds.length,
              isLarge: true,
              conditions: [{ type: 'when', fnString: condition.fn }],
            },
          },
        ]
      : [];
    const nodes: WorkflowStepNode[] = [
      ...conditionNodes,
      {
        id: nodeId,
        position: { x: xIndex * 300, y: (yIndex + (condition ? 1 : 0)) * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label,
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          stepId,
          description,
          withoutTopHandle: condition ? false : !prevNodeIds.length,
          withoutBottomHandle: !nextNodeIds.length,
          mapConfig: stepFlow.type === 'mapping' ? stepFlow.mapConfig : undefined,
        },
      },
    ];
    const edges: WorkflowGraphEdge[] = [
      ...(condition
        ? [
            ...(prevNodeIds || []).map((prevNodeId, i) => ({
              id: getWorkflowEdgeId(prevNodeId, getWorkflowConditionNodeId(condition.id), 'condition'),
              source: prevNodeId,
              data: { previousStepId: prevStepIds[i], nextStepId: stepId, conditionNode: true },
              target: getWorkflowConditionNodeId(condition.id),
              ...defaultEdgeOptions,
            })),
            {
              id: getWorkflowEdgeId(getWorkflowConditionNodeId(condition.id), nodeId, 'condition'),
              source: getWorkflowConditionNodeId(condition.id),
              data: {
                previousStepId: prevStepIds[prevStepIds.length - 1],
                nextStepId: stepId,
                conditionNode: true,
              },
              target: nodeId,
              ...defaultEdgeOptions,
            },
          ]
        : (prevNodeIds || []).map((prevNodeId, i) => ({
            id: getWorkflowEdgeId(prevNodeId, nodeId),
            source: prevNodeId,
            data: { previousStepId: prevStepIds[i], nextStepId: stepId },
            target: nodeId,
            ...defaultEdgeOptions,
          }))),
      ...(nextNodeIds || []).map((nextNodeId, i) => ({
        id: getWorkflowEdgeId(nodeId, nextNodeId),
        source: nodeId,
        data: { previousStepId: stepId, nextStepId: nextStepIds[i] },
        target: nextNodeId,
        ...defaultEdgeOptions,
      })),
    ];
    return { nodes, edges, nextPrevNodeIds: [nodeId], nextPrevStepIds: [stepId] };
  }

  if (stepFlow.type === 'sleep' || stepFlow.type === 'sleepUntil') {
    const rawNodeId = allPrevNodeIds.has(getWorkflowNodeId(stepFlow.id)) ? `${stepFlow.id}-${yIndex}` : stepFlow.id;
    const nodeId = getWorkflowNodeId(rawNodeId);
    const conditionNodes: WorkflowStepNode[] = condition
      ? [
          {
            id: getWorkflowConditionNodeId(condition.id),
            position: { x: xIndex * 300, y: yIndex * 100 },
            type: WORKFLOW_STEP_NODE_TYPE,
            data: {
              label: condition.id,
              workflowStep: conditionWorkflowStep(condition),
              nodeRole: 'condition',
              previousStepId: prevStepIds[prevStepIds.length - 1],
              nextStepId: stepFlow.id,
              withoutTopHandle: false,
              withoutBottomHandle: !nextNodeIds.length,
              isLarge: true,
              conditions: [{ type: 'when', fnString: condition.fn }],
            },
          },
        ]
      : [];
    const nodes: WorkflowStepNode[] = [
      ...conditionNodes,
      {
        id: nodeId,
        position: { x: xIndex * 300, y: (yIndex + (condition ? 1 : 0)) * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: stepFlow.id,
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          stepId: stepFlow.id,
          withoutTopHandle: condition ? false : !prevNodeIds.length,
          withoutBottomHandle: !nextNodeIds.length,
          ...(stepFlow.type === 'sleepUntil' ? { date: stepFlow.date } : { duration: stepFlow.duration }),
        },
      },
    ];
    const edges: WorkflowGraphEdge[] = [
      ...(!prevNodeIds.length
        ? []
        : condition
          ? [
              ...prevNodeIds.map((prevNodeId, i) => ({
                id: getWorkflowEdgeId(prevNodeId, getWorkflowConditionNodeId(condition.id), 'condition'),
                source: prevNodeId,
                data: { previousStepId: prevStepIds[i], nextStepId: stepFlow.id, conditionNode: true },
                target: getWorkflowConditionNodeId(condition.id),
                ...defaultEdgeOptions,
              })),
              {
                id: getWorkflowEdgeId(getWorkflowConditionNodeId(condition.id), nodeId, 'condition'),
                source: getWorkflowConditionNodeId(condition.id),
                data: {
                  previousStepId: prevStepIds[prevStepIds.length - 1],
                  nextStepId: stepFlow.id,
                  conditionNode: true,
                },
                target: nodeId,
                ...defaultEdgeOptions,
              },
            ]
          : prevNodeIds.map((prevNodeId, i) => ({
              id: getWorkflowEdgeId(prevNodeId, nodeId),
              source: prevNodeId,
              data: { previousStepId: prevStepIds[i], nextStepId: stepFlow.id },
              target: nodeId,
              ...defaultEdgeOptions,
            }))),
      ...(!nextNodeIds.length
        ? []
        : nextNodeIds.map((nextNodeId, i) => ({
            id: getWorkflowEdgeId(nodeId, nextNodeId),
            source: nodeId,
            data: { previousStepId: stepFlow.id, nextStepId: nextStepIds[i] },
            target: nextNodeId,
            ...defaultEdgeOptions,
          }))),
    ];
    return { nodes, edges, nextPrevNodeIds: [nodeId], nextPrevStepIds: [stepFlow.id] };
  }

  if (stepFlow.type === 'loop') {
    const { step: _step, serializedCondition, loopType } = stepFlow;
    const nodeId = getWorkflowNodeId(_step.id);
    const conditionNodeId = getWorkflowConditionNodeId(serializedCondition.id);
    const nodes: WorkflowStepNode[] = [
      {
        id: nodeId,
        position: { x: xIndex * 300, y: yIndex * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: _step.id,
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          stepId: _step.id,
          description: _step.description,
          withoutTopHandle: !prevNodeIds.length,
          withoutBottomHandle: false,
          stepGraph: _step.component === 'WORKFLOW' ? _step.serializedStepFlow : undefined,
          canSuspend: _step.canSuspend,
          metadata: _step.metadata,
        },
      },
      {
        id: conditionNodeId,
        position: { x: xIndex * 300, y: (yIndex + 1) * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: serializedCondition.id,
          workflowStep: conditionWorkflowStep(serializedCondition),
          nodeRole: 'condition',
          // conditionStepId: _step.id,
          previousStepId: _step.id,
          nextStepId: nextStepIds[0],
          withoutTopHandle: false,
          withoutBottomHandle: !nextNodeIds.length,
          isLarge: true,
          conditions: [{ type: loopType, fnString: serializedCondition.fn }],
        },
      },
    ];

    const edges: WorkflowGraphEdge[] = [
      ...(!prevNodeIds.length
        ? []
        : prevNodeIds.map((prevNodeId, i) => ({
            id: getWorkflowEdgeId(prevNodeId, nodeId),
            source: prevNodeId,
            data: { previousStepId: prevStepIds[i], nextStepId: _step.id },
            target: nodeId,
            ...defaultEdgeOptions,
          }))),
      {
        id: getWorkflowEdgeId(nodeId, conditionNodeId, 'condition'),
        source: nodeId,
        data: { previousStepId: _step.id, nextStepId: nextStepIds[0] },
        target: conditionNodeId,
        ...defaultEdgeOptions,
      },
      ...(!nextNodeIds.length
        ? []
        : nextNodeIds.map((nextNodeId, i) => ({
            id: getWorkflowEdgeId(conditionNodeId, nextNodeId, 'condition'),
            source: conditionNodeId,
            data: { previousStepId: _step.id, nextStepId: nextStepIds[i] },
            target: nextNodeId,
            ...defaultEdgeOptions,
          }))),
    ];

    return { nodes, edges, nextPrevNodeIds: [conditionNodeId], nextPrevStepIds: [_step.id] };
  }

  if (stepFlow.type === 'parallel') {
    let nodes: WorkflowStepNode[] = [];
    let edges: WorkflowGraphEdge[] = [];
    let nextPrevStepIds: string[] = [];
    stepFlow.steps.forEach((_stepFlow, index) => {
      const {
        nodes: _nodes,
        edges: _edges,
        nextPrevStepIds: _nextPrevStepIds,
      } = getStepNodeAndEdge({
        stepFlow: _stepFlow,
        xIndex: index,
        yIndex,
        prevNodeIds,
        prevStepIds,
        nextStepFlow,
        allPrevNodeIds,
      });
      // Mark nodes as part of parallel execution
      const markedNodes: WorkflowStepNode[] = _nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          isParallel: true,
        },
      }));
      nodes.push(...markedNodes);
      edges.push(..._edges);
      nextPrevStepIds.push(..._nextPrevStepIds);
    });

    return { nodes, edges, nextPrevNodeIds: nodes.map(node => node.id), nextPrevStepIds };
  }

  if (stepFlow.type === 'conditional') {
    let nodes: WorkflowStepNode[] = [];
    let edges: WorkflowGraphEdge[] = [];
    let nextPrevStepIds: string[] = [];
    stepFlow.steps.forEach((_stepFlow, index) => {
      const {
        nodes: _nodes,
        edges: _edges,
        nextPrevStepIds: _nextPrevStepIds,
      } = getStepNodeAndEdge({
        stepFlow: _stepFlow,
        xIndex: index,
        yIndex,
        prevNodeIds,
        prevStepIds,
        nextStepFlow,
        condition: stepFlow.serializedConditions[index],
        allPrevNodeIds,
      });
      nodes.push(..._nodes);
      edges.push(..._edges);
      nextPrevStepIds.push(..._nextPrevStepIds);
    });

    return {
      nodes,
      edges,
      nextPrevNodeIds: nodes.filter(({ data }) => data.nodeRole !== 'condition').map(node => node.id),
      nextPrevStepIds,
    };
  }

  return { nodes: [], edges: [], nextPrevNodeIds: [], nextPrevStepIds: [] };
};

export const constructNodesAndEdges = ({
  stepGraph,
}: {
  stepGraph?: Workflow['serializedStepGraph'];
}): { nodes: WorkflowGraphNode[]; edges: WorkflowGraphEdge[] } => {
  if (!stepGraph) {
    return { nodes: [], edges: [] };
  }

  if (stepGraph.length === 0) {
    return { nodes: [], edges: [] };
  }

  let nodes: WorkflowStepNode[] = [];
  let edges: WorkflowGraphEdge[] = [];

  let prevNodeIds: string[] = [];
  let prevStepIds: string[] = [];
  const allPrevNodeIds = new Set<string>();

  for (let index = 0; index < stepGraph.length; index++) {
    const {
      nodes: _nodes,
      edges: _edges,
      nextPrevNodeIds,
      nextPrevStepIds,
    } = getStepNodeAndEdge({
      stepFlow: stepGraph[index],
      xIndex: index,
      yIndex: index,
      prevNodeIds,
      prevStepIds,
      nextStepFlow: index === stepGraph.length - 1 ? undefined : stepGraph[index + 1],
      allPrevNodeIds,
    });
    nodes.push(..._nodes);
    edges.push(..._edges);
    prevNodeIds = nextPrevNodeIds;
    prevStepIds = nextPrevStepIds;
    for (const nodeId of prevNodeIds) {
      allPrevNodeIds.add(nodeId);
    }
  }

  const edgeTargetIds = new Set(edges.map(edge => edge.target));
  const edgeSourceIds = new Set(edges.map(edge => edge.source));
  const sourceNodeIds = nodes.filter(node => !edgeTargetIds.has(node.id)).map(node => node.id);
  const terminalNodeIds = nodes.filter(node => !edgeSourceIds.has(node.id)).map(node => node.id);
  const sourceNodeIdSet = new Set(sourceNodeIds);
  const terminalNodeIdSet = new Set(terminalNodeIds);

  nodes = nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      ...(sourceNodeIdSet.has(node.id) ? { withoutTopHandle: false } : {}),
      ...(terminalNodeIdSet.has(node.id) ? { withoutBottomHandle: false } : {}),
    },
  }));

  const graphNodes: WorkflowGraphNode[] = [
    {
      id: WORKFLOW_START_NODE_ID,
      position: { x: 0, y: 0 },
      type: WORKFLOW_BOUNDARY_NODE_TYPE,
      data: { label: 'Start', boundaryRole: 'start' },
    },
    ...nodes,
    {
      id: WORKFLOW_END_NODE_ID,
      position: { x: 0, y: 0 },
      type: WORKFLOW_BOUNDARY_NODE_TYPE,
      data: { label: 'End', boundaryRole: 'end' },
    },
  ];

  const sourceBoundaryEdges: WorkflowGraphEdge[] = sourceNodeIds.map(nodeId => ({
    id: getWorkflowEdgeId(WORKFLOW_START_NODE_ID, nodeId, 'boundary'),
    source: WORKFLOW_START_NODE_ID,
    target: nodeId,
    data: {
      boundaryPayload: 'workflow-input',
      nextStepId: (() => {
        const targetNode = graphNodes.find(node => node.id === nodeId);
        if (targetNode?.type !== WORKFLOW_STEP_NODE_TYPE) return nodeId;
        return targetNode?.data.stepId ?? targetNode?.data.nextStepId ?? nodeId;
      })(),
    },
    ...defaultEdgeOptions,
  }));
  const terminalBoundaryEdges: WorkflowGraphEdge[] = terminalNodeIds.map(nodeId => ({
    id: getWorkflowEdgeId(nodeId, WORKFLOW_END_NODE_ID, 'boundary'),
    source: nodeId,
    target: WORKFLOW_END_NODE_ID,
    data: { boundaryPayload: 'workflow-output' },
    ...defaultEdgeOptions,
  }));

  edges = [...sourceBoundaryEdges, ...edges, ...terminalBoundaryEdges];

  edges = normalizeDuplicateEdgeIds(edges);

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(graphNodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

export const buildStepsFlow = (edges: WorkflowGraphEdge[]): Record<string, string[]> =>
  edges.reduce(
    (acc, edge) => {
      if (!edge.data || edge.data.boundaryPayload) {
        return acc;
      }

      const stepId = edge.data?.nextStepId;
      const prevStepId = edge.data?.previousStepId;

      if (!stepId || !prevStepId) {
        return acc;
      }

      return {
        ...acc,
        [stepId]: [...new Set([...(acc[stepId] || []), prevStepId])],
      };
    },
    {} as Record<string, string[]>,
  );

/**
 * Invert the predecessor map (step -> its predecessors) into a successor map
 * (step -> the steps that depend on it). Branch arms feed the same downstream
 * join node, so this lets us detect arms that were never taken once a sibling
 * on the same join has already succeeded.
 */
export const buildStepSuccessors = (stepsFlow: Record<string, string[]>): Record<string, string[]> =>
  Object.entries(stepsFlow).reduce(
    (acc, [stepId, prevStepIds]) => {
      for (const prevStepId of prevStepIds) {
        acc[prevStepId] = [...new Set([...(acc[prevStepId] || []), stepId])];
      }
      return acc;
    },
    {} as Record<string, string[]>,
  );

/**
 * Walk the serialized step graph to flag two special kinds of step:
 * - `conditionalStepIds`: arms of a conditional entry. Only these can be
 *   "bypassed" — when one branch arm is selected, the others never run.
 *   Parallel arms also share a downstream join, but every parallel arm must
 *   run, so they are deliberately NOT collected here.
 * - `nestedWorkflowStepIds`: steps whose component is a nested workflow. From
 *   the parent's perspective a nested workflow is a single atomic step.
 */
export const collectGraphStepFlags = (
  stepGraph: SerializedStepFlowEntry[] | undefined,
): { conditionalStepIds: Set<string>; nestedWorkflowStepIds: Set<string> } => {
  const conditionalStepIds = new Set<string>();
  const nestedWorkflowStepIds = new Set<string>();

  const visit = (entry: SerializedStepFlowEntry | undefined) => {
    if (!entry) return;
    if (entry.type === 'workflow') {
      nestedWorkflowStepIds.add(entry.id);
      return;
    }
    if (entry.type === 'step' || entry.type === 'foreach' || entry.type === 'loop') {
      const inner = entry.type === 'foreach' ? unwrapForeachInner(entry.step) : entry.step;
      if (inner?.component === 'WORKFLOW' && inner?.id) {
        nestedWorkflowStepIds.add(inner.id);
      }
    }
    if (entry.type === 'conditional') {
      for (const child of entry.steps) {
        conditionalStepIds.add(getSingleStepFlowId(child));
        visit(child);
      }
    }
    if (entry.type === 'parallel') {
      for (const child of entry.steps) {
        visit(child);
      }
    }
  };

  for (const entry of stepGraph ?? []) {
    visit(entry);
  }

  return { conditionalStepIds, nestedWorkflowStepIds };
};

type StepStatusLookup = (stepId: string) => boolean;

/**
 * A conditional branch arm is "bypassed" when one of its successors (a join
 * such as a post-branch map) already has another predecessor that succeeded.
 * That means a sibling arm was the one selected by the condition, so this arm
 * will never run and must be skipped — otherwise per-step execution stalls on
 * it forever. Parallel arms are excluded via `conditionalStepIds`, because
 * every parallel arm is expected to run even though they share a join.
 */
export const isBranchArmBypassed = ({
  stepId,
  conditionalStepIds,
  stepSuccessors,
  stepsFlow,
  isStepSuccess,
}: {
  stepId: string;
  conditionalStepIds: Set<string>;
  stepSuccessors: Record<string, string[]>;
  stepsFlow: Record<string, string[]>;
  isStepSuccess: StepStatusLookup;
}): boolean => {
  if (!conditionalStepIds.has(stepId)) return false;
  const successors = stepSuccessors[stepId] ?? [];
  return successors.some(successorId =>
    (stepsFlow[successorId] ?? []).some(sib => sib !== stepId && isStepSuccess(sib)),
  );
};

/**
 * The next step to advance is the first step in graph order that has not yet
 * succeeded and was not bypassed by a conditional branch decision.
 */
export const selectNextStepKey = ({
  stepNodesInOrder,
  isStepSuccess,
  isStepBypassed,
}: {
  stepNodesInOrder: string[];
  isStepSuccess: StepStatusLookup;
  isStepBypassed: StepStatusLookup;
}): string | undefined => stepNodesInOrder.find(stepId => !isStepSuccess(stepId) && !isStepBypassed(stepId));

/**
 * A step is the last runnable one when no later step in graph order still needs
 * to run (ignoring bypassed branch arms). The final advance must finish the run
 * instead of pausing again, otherwise the workflow ends in a 'paused' state and
 * the user never sees the run's end output.
 */
export const isLastRunnableStep = ({
  nextStepKey,
  stepNodesInOrder,
  isStepSuccess,
  isStepBypassed,
}: {
  nextStepKey: string | undefined;
  stepNodesInOrder: string[];
  isStepSuccess: StepStatusLookup;
  isStepBypassed: StepStatusLookup;
}): boolean => {
  if (!nextStepKey) return false;
  const nextIndex = stepNodesInOrder.indexOf(nextStepKey);
  return stepNodesInOrder.slice(nextIndex + 1).every(stepId => isStepSuccess(stepId) || isStepBypassed(stepId));
};

/**
 * True when every predecessor step has succeeded. A join is only runnable once all of its
 * parallel arms have produced an output; a skipped or still-running arm makes it false.
 * An empty predecessor set is vacuously resolved (callers handle the no-predecessor case
 * separately before consulting this predicate).
 */
/**
 * A join is ready when every predecessor is accounted for: it either succeeded
 * (it produced an output to forward) or it was bypassed (a dead conditional-branch
 * arm that will never run). A still-running or pending arm leaves the join unresolved.
 * Parallel arms are never bypassed, so a paused parallel join only resolves once all
 * arms succeed.
 */
export const allPredecessorsResolved = (
  previousSteps: string[],
  steps: Record<string, { status?: string }> | undefined,
  isBypassed: (stepId: string) => boolean = () => false,
): boolean => previousSteps.every(stepId => steps?.[stepId]?.status === 'success' || isBypassed(stepId));

/**
 * Resolve the graph node that represents a given step id. Default/parallel nodes
 * carry `data.stepId`; condition nodes fall back to `data.label`. Returns
 * undefined when no node matches (e.g. before React Flow has laid out the graph).
 */
export const findFocusNode = (nodes: Node[], stepId: string): Node | undefined =>
  nodes.find(node => (node.data?.stepId ?? node.data?.label) === stepId);

/**
 * Build the input payload for the next step from its resolved predecessors:
 * - A join with multiple predecessors yields a keyed map of each succeeded
 *   predecessor's output (`hasMultiSteps`); bypassed dead branch arms are excluded.
 * - A single predecessor yields its output directly.
 * Returns undefined when the step has no predecessor, or when any predecessor is
 * still unresolved (not succeeded and not bypassed) — e.g. a paused parallel join
 * where only some arms have finished.
 */
export const buildNextStepInput = ({
  nextStepKey,
  stepsFlow,
  steps,
  isStepBypassed = () => false,
}: {
  nextStepKey: string | undefined;
  stepsFlow: Record<string, string[]>;
  steps: Record<string, { status?: string; output?: any }> | undefined;
  isStepBypassed?: (stepId: string) => boolean;
}): { hasMultiSteps: boolean; input: any } | undefined => {
  if (!nextStepKey) return undefined;
  const previousSteps = stepsFlow?.[nextStepKey] ?? [];
  if (previousSteps.length === 0) return undefined;

  if (previousSteps.length > 1) {
    // A join can only run once every predecessor is accounted for. A still-running or pending
    // arm leaves the input incomplete, so the step is not runnable yet — return undefined rather
    // than a partial map (which would wrongly enable "Run next step", e.g. on a paused parallel
    // join where only one arm has finished). Bypassed dead branch arms are excluded from the map.
    if (!allPredecessorsResolved(previousSteps, steps, isStepBypassed)) return undefined;

    return {
      hasMultiSteps: true,
      input: previousSteps
        .filter(stepId => steps?.[stepId]?.status === 'success')
        .reduce<Record<string, unknown>>((acc, stepId) => {
          acc[stepId] = steps?.[stepId]?.output;
          return acc;
        }, {}),
    };
  }

  const prevStepId = previousSteps[0];
  if (steps?.[prevStepId]?.status === 'success') {
    return {
      hasMultiSteps: false,
      input: steps?.[prevStepId]?.output,
    };
  }

  return undefined;
};
