import Dagre from '@dagrejs/dagre';
import { Workflow, SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';

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

export const pathAlphabet = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase().split('');

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB' });

  edges.forEach(edge => g.setEdge(edge.source, edge.target));
  nodes.forEach(node =>
    g.setNode(node.id, {
      ...node,
      width: node.measured?.width ?? 274,
      height: node.measured?.height ?? (node?.data?.isLarge ? 260 : 100),
    }),
  );

  Dagre.layout(g);

  const fullWidth = g.graph()?.width ? g.graph().width! / 2 : 0;
  const fullHeight = g.graph()?.height ? g.graph().height! / 2 : 0;

  return {
    nodes: nodes.map(node => {
      const position = g.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const positionX = position.x - (node.measured?.width ?? 274) / 2;
      const positionY = position.y - (node.measured?.height ?? (node?.data?.isLarge ? 260 : 100)) / 2;
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
  if (
    nextStepFlow?.type === 'step' ||
    nextStepFlow?.type === 'foreach' ||
    nextStepFlow?.type === 'loop' ||
    nextStepFlow?.type === 'waitForEvent'
  ) {
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
        const stepId = (step as { type: 'step'; step: { id: string } }).step.id;
        const nextStepId = allPrevNodeIds?.includes(stepId) ? `${stepId}-${yIndex + 1}` : stepId;
        return nextStepId;
      }) || [];
    nextStepIds = nextStepFlow?.steps.map(step => (step as { type: 'step'; step: { id: string } }).step.id) || [];
  }
  if (nextStepFlow?.type === 'conditional') {
    nextNodeIds = nextStepFlow?.serializedConditions.map(cond => cond.id) || [];
    nextStepIds = nextStepFlow?.steps?.map(step => (step as { type: 'step'; step: { id: string } }).step.id) || [];
  }

  if (stepFlow.type === 'step' || stepFlow.type === 'foreach' || stepFlow.type === 'waitForEvent') {
    const hasGraph = stepFlow.step.component === 'WORKFLOW';
    const nodeId = allPrevNodeIds?.includes(stepFlow.step.id) ? `${stepFlow.step.id}-${yIndex}` : stepFlow.step.id;
    const nodes = [
      ...(condition
        ? [
            {
              id: condition.id,
              position: { x: xIndex * 300, y: yIndex * 100 },
              type: 'condition-node',
              data: {
                label: condition.id,
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
        type: hasGraph ? 'nested-node' : 'default-node',
        data: {
          label: stepFlow.step.id,
          description: stepFlow.step.description,
          withoutTopHandle: condition ? false : !prevNodeIds.length,
          withoutBottomHandle: !nextNodeIds.length,
          stepGraph: hasGraph ? stepFlow.step.serializedStepFlow : undefined,
          mapConfig: stepFlow.step.mapConfig,
          ...(stepFlow.type === 'waitForEvent' ? { event: stepFlow.event } : {}),
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
              type: 'condition-node',
              data: {
                label: condition.id,
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
        type: 'default-node',
        data: {
          label: stepFlow.id,
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
    const hasGraph = _step.component === 'WORKFLOW';
    const nodes = [
      {
        id: _step.id,
        position: { x: xIndex * 300, y: yIndex * 100 },
        type: hasGraph ? 'nested-node' : 'default-node',
        data: {
          label: _step.id,
          description: _step.description,
          withoutTopHandle: !prevNodeIds.length,
          withoutBottomHandle: false,
          stepGraph: hasGraph ? _step.serializedStepFlow : undefined,
        },
      },
      {
        id: serializedCondition.id,
        position: { x: xIndex * 300, y: (yIndex + 1) * 100 },
        type: 'condition-node',
        data: {
          label: serializedCondition.id,
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
      nodes.push(..._nodes);
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
      nextPrevNodeIds: nodes.filter(({ type }) => type !== 'condition-node').map(node => node.id),
      nextPrevStepIds,
    };
  }

  return { nodes: [], edges: [], nextPrevNodeIds: [], nextPrevStepIds: [] };
};

export const constructNodesAndEdges = ({
  stepGraph,
}: {
  stepGraph: Workflow['serializedStepGraph'];
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

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};
