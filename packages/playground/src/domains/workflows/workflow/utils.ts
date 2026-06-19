import Dagre from '@dagrejs/dagre';
import type { Workflow, SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import {
  resolveWorkflowGraphStep,
  WORKFLOW_BOUNDARY_NODE_TYPE,
  WORKFLOW_STEP_NODE_TYPE,
} from './workflow-step-node-utils';

const WORKFLOW_START_NODE_ID = '__workflow-start__';
const WORKFLOW_END_NODE_ID = '__workflow-end__';

const getNodeSize = (node: Node): { width: number; height: number } => {
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

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
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
  allPrevNodeIds: string[];
}): { nodes: Node[]; edges: Edge[]; nextPrevNodeIds: string[]; nextPrevStepIds: string[] } => {
  let nextNodeIds: string[] = [];
  let nextStepIds: string[] = [];
  if (nextStepFlow?.type === 'step' || nextStepFlow?.type === 'foreach' || nextStepFlow?.type === 'loop') {
    const nextStepId = allPrevNodeIds?.includes(nextStepFlow.step.id)
      ? `${nextStepFlow.step.id}-${yIndex + 1}`
      : nextStepFlow.step.id;
    nextNodeIds = [nextStepId];
    nextStepIds = [nextStepFlow.step.id];
  }
  if (nextStepFlow?.type === 'sleep' || nextStepFlow?.type === 'sleepUntil') {
    const nextStepId = allPrevNodeIds?.includes(nextStepFlow.id) ? `${nextStepFlow.id}-${yIndex + 1}` : nextStepFlow.id;
    nextNodeIds = [nextStepId];
    nextStepIds = [nextStepFlow.id];
  }
  if (nextStepFlow?.type === 'parallel') {
    nextNodeIds =
      nextStepFlow?.steps.map(step => {
        const stepId = step.step.id;
        const nextStepId = allPrevNodeIds?.includes(stepId) ? `${stepId}-${yIndex + 1}` : stepId;
        return nextStepId;
      }) || [];
    nextStepIds = nextStepFlow?.steps.map(step => step.step.id) || [];
  }
  if (nextStepFlow?.type === 'conditional') {
    nextNodeIds = nextStepFlow?.serializedConditions.map(cond => cond.id) || [];
    nextStepIds = nextStepFlow?.steps?.map(step => step.step.id) || [];
  }

  if (stepFlow.type === 'step' || stepFlow.type === 'foreach') {
    const hasGraph = stepFlow.step.component === 'WORKFLOW';
    const nodeId = allPrevNodeIds?.includes(stepFlow.step.id) ? `${stepFlow.step.id}-${yIndex}` : stepFlow.step.id;
    const nodes = [
      ...(condition
        ? [
            {
              id: condition.id,
              position: { x: xIndex * 300, y: yIndex * 100 },
              type: WORKFLOW_STEP_NODE_TYPE,
              data: {
                label: condition.id,
                workflowStep: conditionWorkflowStep(condition),
                nodeRole: 'condition',
                previousStepId: prevStepIds[prevStepIds.length - 1],
                nextStepId: stepFlow.step.id,
                withoutTopHandle: !prevNodeIds.length,
                withoutBottomHandle: !nextNodeIds.length,
                isLarge: true,
                conditions: [{ type: 'when', fnString: condition.fn }],
              },
            },
          ]
        : []),
      {
        id: nodeId,
        position: { x: xIndex * 300, y: (yIndex + (condition ? 1 : 0)) * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: formatMappingLabel(stepFlow.step.id, prevStepIds, nextStepIds),
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          stepId: stepFlow.step.id,
          description: stepFlow.step.description,
          withoutTopHandle: condition ? false : !prevNodeIds.length,
          withoutBottomHandle: !nextNodeIds.length,
          stepGraph: hasGraph ? stepFlow.step.serializedStepFlow : undefined,
          mapConfig: stepFlow.step.mapConfig,
          canSuspend: stepFlow.step.canSuspend,
          isForEach: stepFlow.type === 'foreach',
          metadata: stepFlow.step.metadata,
        },
      },
    ];
    const edges = [
      ...(condition
        ? [
            ...(prevNodeIds || []).map((prevNodeId, i) => ({
              id: `e${prevNodeId}-${condition.id}`,
              source: prevNodeId,
              data: { previousStepId: prevStepIds[i], nextStepId: stepFlow.step.id },
              target: condition.id,
              ...defaultEdgeOptions,
            })),
            {
              id: `e${condition.id}-${nodeId}`,
              source: condition.id,
              data: {
                previousStepId: prevStepIds[prevStepIds.length - 1],
                nextStepId: stepFlow.step.id,
                conditionNode: true,
              },
              target: nodeId,
              ...defaultEdgeOptions,
            },
          ]
        : (prevNodeIds || []).map((prevNodeId, i) => ({
            id: `e${prevNodeId}-${nodeId}`,
            source: prevNodeId,
            data: { previousStepId: prevStepIds[i], nextStepId: stepFlow.step.id },
            target: nodeId,
            ...defaultEdgeOptions,
          }))),
      ...(nextNodeIds || []).map((nextNodeId, i) => ({
        id: `e${nodeId}-${nextNodeId}`,
        source: nodeId,
        data: { previousStepId: stepFlow.step.id, nextStepId: nextStepIds[i] },
        target: nextNodeId,
        ...defaultEdgeOptions,
      })),
    ];
    return { nodes, edges, nextPrevNodeIds: [nodeId], nextPrevStepIds: [stepFlow.step.id] };
  }

  if (stepFlow.type === 'sleep' || stepFlow.type === 'sleepUntil') {
    const nodeId = allPrevNodeIds?.includes(stepFlow.id) ? `${stepFlow.id}-${yIndex}` : stepFlow.id;
    const nodes = [
      ...(condition
        ? [
            {
              id: condition.id,
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
        : []),
      {
        id: nodeId,
        position: { x: xIndex * 300, y: (yIndex + (condition ? 1 : 0)) * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: stepFlow.id,
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          withoutTopHandle: condition ? false : !prevNodeIds.length,
          withoutBottomHandle: !nextNodeIds.length,
          ...(stepFlow.type === 'sleepUntil' ? { date: stepFlow.date } : { duration: stepFlow.duration }),
        },
      },
    ];
    const edges = [
      ...(!prevNodeIds.length
        ? []
        : condition
          ? [
              ...prevNodeIds.map((prevNodeId, i) => ({
                id: `e${prevNodeId}-${condition.id}`,
                source: prevNodeId,
                data: { previousStepId: prevStepIds[i], nextStepId: stepFlow.id },
                target: condition.id,
                ...defaultEdgeOptions,
              })),
              {
                id: `e${condition.id}-${nodeId}`,
                source: condition.id,
                data: { previousStepId: prevStepIds[prevStepIds.length - 1], nextStepId: stepFlow.id },
                target: nodeId,
                ...defaultEdgeOptions,
              },
            ]
          : prevNodeIds.map((prevNodeId, i) => ({
              id: `e${prevNodeId}-${nodeId}`,
              source: prevNodeId,
              data: { previousStepId: prevStepIds[i], nextStepId: stepFlow.id },
              target: nodeId,
              ...defaultEdgeOptions,
            }))),
      ...(!nextNodeIds.length
        ? []
        : nextNodeIds.map((nextNodeId, i) => ({
            id: `e${nodeId}-${nextNodeId}`,
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
    const nodes = [
      {
        id: _step.id,
        position: { x: xIndex * 300, y: yIndex * 100 },
        type: WORKFLOW_STEP_NODE_TYPE,
        data: {
          label: _step.id,
          workflowStep: resolveWorkflowGraphStep(stepFlow),
          description: _step.description,
          withoutTopHandle: !prevNodeIds.length,
          withoutBottomHandle: false,
          stepGraph: _step.component === 'WORKFLOW' ? _step.serializedStepFlow : undefined,
          canSuspend: _step.canSuspend,
          metadata: _step.metadata,
        },
      },
      {
        id: serializedCondition.id,
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

    const edges = [
      ...(!prevNodeIds.length
        ? []
        : prevNodeIds.map((prevNodeId, i) => ({
            id: `e${prevNodeId}-${_step.id}`,
            source: prevNodeId,
            data: { previousStepId: prevStepIds[i], nextStepId: _step.id },
            target: _step.id,
            ...defaultEdgeOptions,
          }))),
      {
        id: `e${_step.id}-${serializedCondition.id}`,
        source: _step.id,
        data: { previousStepId: _step.id, nextStepId: nextStepIds[0] },
        target: serializedCondition.id,
        ...defaultEdgeOptions,
      },
      ...(!nextNodeIds.length
        ? []
        : nextNodeIds.map((nextNodeId, i) => ({
            id: `e${serializedCondition.id}-${nextNodeId}`,
            source: serializedCondition.id,
            data: { previousStepId: _step.id, nextStepId: nextStepIds[i] },
            target: nextNodeId,
            ...defaultEdgeOptions,
          }))),
    ];

    return { nodes, edges, nextPrevNodeIds: [serializedCondition.id], nextPrevStepIds: [_step.id] };
  }

  if (stepFlow.type === 'parallel') {
    let nodes: Node[] = [];
    let edges: Edge[] = [];
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
      const markedNodes = _nodes.map(node => ({
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
    let nodes: Node[] = [];
    let edges: Edge[] = [];
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
}): { nodes: Node[]; edges: Edge[] } => {
  if (!stepGraph) {
    return { nodes: [], edges: [] };
  }

  if (stepGraph.length === 0) {
    return { nodes: [], edges: [] };
  }

  let nodes: Node[] = [];
  let edges: Edge[] = [];

  let prevNodeIds: string[] = [];
  let prevStepIds: string[] = [];
  let allPrevNodeIds: string[] = [];

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
    allPrevNodeIds.push(...prevNodeIds);
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

  nodes = [
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

  edges = [
    ...sourceNodeIds.map(nodeId => ({
      id: `e${WORKFLOW_START_NODE_ID}-${nodeId}`,
      source: WORKFLOW_START_NODE_ID,
      target: nodeId,
      data: { boundaryPayload: 'workflow-input' },
      ...defaultEdgeOptions,
    })),
    ...edges,
    ...terminalNodeIds.map(nodeId => ({
      id: `e${nodeId}-${WORKFLOW_END_NODE_ID}`,
      source: nodeId,
      target: WORKFLOW_END_NODE_ID,
      data: { boundaryPayload: 'workflow-output' },
      ...defaultEdgeOptions,
    })),
  ];

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

export const buildStepsFlow = (edges: Edge[]): Record<string, string[]> =>
  edges.reduce(
    (acc, edge) => {
      if (!edge.data || edge.data.boundaryPayload) {
        return acc;
      }

      const stepId = edge.data.nextStepId as string;
      const prevStepId = edge.data.previousStepId as string;

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
