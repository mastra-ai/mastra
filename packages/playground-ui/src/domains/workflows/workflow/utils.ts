import Dagre from '@dagrejs/dagre';
import type { StepCondition } from '@mastra/core/workflows';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';

export type Condition =
  | {
      ref: {
        step:
          | {
              id: string;
            }
          | 'trigger';
        path: string;
      };
      query: Record<string, any>;
      conj?: 'and' | 'or';
      fnString?: never;
    }
  | {
      fnString: string;
      ref?: never;
      query?: never;
      conj?: never;
    };

export const pathAlphabet = 'abcdefghijklmnopqrstuvwxyz'.toUpperCase().split('');

export function extractConditions(group?: StepCondition<any, any>) {
  let result: Condition[] = [];
  if (!group) return result;

  function recurse(group: StepCondition<any, any>, conj?: 'and' | 'or') {
    if (typeof group === 'string') {
      result.push({ fnString: group });
    } else {
      const simpleCondition = Object.entries(group).find(([key]) => key.includes('.'));
      if (simpleCondition) {
        const [key, queryValue] = simpleCondition;
        const [stepId, ...pathParts] = key.split('.');
        const ref = {
          step: {
            id: stepId,
          },
          path: pathParts.join('.'),
        };
        result.push({
          ref,
          query: { [queryValue === true || queryValue === false ? 'is' : 'eq']: String(queryValue) },
          conj,
        });
      }
      if ('ref' in group) {
        const { ref, query } = group;
        result.push({ ref, query, conj });
      }
      if ('and' in group) {
        for (const subGroup of group.and) {
          recurse({ ...subGroup }, 'and');
        }
      }
      if ('or' in group) {
        for (const subGroup of group.or) {
          recurse({ ...subGroup }, 'or');
        }
      }
    }
  }

  recurse(group);
  return result.reverse();
}

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

  return {
    nodes: nodes.map(node => {
      const position = g.node(node.id);
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      const x = position.x - (node.measured?.width ?? 274) / 2;
      const y = position.y - (node.measured?.height ?? (node?.data?.isLarge ? 260 : 100)) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
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

export const contructNodesAndEdges = ({
  stepGraph,
  stepSubscriberGraph,
}: {
  stepGraph: any;
  stepSubscriberGraph: any;
}): { nodes: Node[]; edges: Edge[] } => {
  if (!stepGraph) {
    return { nodes: [], edges: [] };
  }
  const { initial, ...stepsList } = stepGraph;
  if (!initial.length) {
    return { nodes: [], edges: [] };
  }

  let nodes: Node[] = [];
  let edges: Edge[] = [];

  for (const [_index, _step] of initial.entries()) {
    const step = _step.step;
    const stepId = step.id;
    const steps = [_step, ...(stepsList?.[stepId] || [])]?.reduce((acc, step, i) => {
      const newStep = {
        ...step.step,
        label: step.step.id,
        type: 'default-node',
        id: nodes.some(node => node.id === step.step.id) ? `${step.step.id}-${i}` : step.step.id,
      };
      if (step.config?.serializedWhen) {
        const conditions = extractConditions(step.config.serializedWhen);
        const conditionStep = {
          id: crypto.randomUUID(),
          conditions,
          type: 'condition-node',
          isLarge: conditions?.length > 1 || conditions.some(({ fnString }) => !!fnString),
        };

        acc.push(conditionStep);
      }
      acc.push(newStep);
      return acc;
    }, []);

    const newNodes = [...steps].map((step: any, index: number) => {
      const subscriberGraph = stepSubscriberGraph?.[step.id];
      return {
        id: step.id,
        position: { x: _index * 300, y: index * 100 },
        type: step.type,
        data: {
          conditions: step.conditions,
          label: step.label,
          description: step.description,
          withoutTopHandle: subscriberGraph?.[step.id] ? false : index === 0,
          withoutBottomHandle: subscriberGraph ? false : index === steps.length - 1,
          isLarge: step.isLarge,
        },
      };
    });

    nodes = [...nodes, ...newNodes];

    const edgeSteps = [...steps].slice(0, -1);

    const newEdges = edgeSteps.map((step: any, index: number) => ({
      id: `e${step.id}-${steps[index + 1].id}`,
      source: step.id,
      target: steps[index + 1].id,
      ...defaultEdgeOptions,
    }));

    edges = [...edges, ...newEdges];
  }

  if (!stepSubscriberGraph || !Object.keys(stepSubscriberGraph).length) {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);
    return { nodes: layoutedNodes, edges: layoutedEdges };
  }

  for (const [connectingStepId, stepInfoGraph] of Object.entries(stepSubscriberGraph)) {
    const { initial, ...stepsList } = stepInfoGraph as any;

    if (initial.length) {
      for (const [_index, _step] of initial.entries()) {
        const step = _step.step;
        const stepId = step.id;
        const originalSteps = [_step, ...(stepsList?.[stepId] || [])]?.map(step => step.step);
        const steps = [_step, ...(stepsList?.[stepId] || [])]?.reduce((acc, step, i) => {
          const newStep = {
            ...step.step,
            label: step.step.id,
            type: 'default-node',
            id: nodes.some(node => node.id === step.step.id) ? `${step.step.id}-${i}` : step.step.id,
          };
          if (step.config?.serializedWhen) {
            const conditions = extractConditions(step.config.serializedWhen);
            const conditionStep = {
              id: crypto.randomUUID(),
              conditions,
              type: 'condition-node',
              isLarge: conditions?.length > 1 || conditions.some(({ fnString }) => !!fnString),
            };

            acc.push(conditionStep);
          }

          acc.push(newStep);
          return acc;
        }, []);

        const newNodes = [...steps].map((step: any, index: number) => {
          const subscriberGraph = stepSubscriberGraph?.[step.id];
          return {
            id: step.id,
            position: { x: _index * 300 + 300, y: index * 100 + 100 },
            type: step.type,
            data: {
              conditions: step.conditions,
              label: step.label,
              description: step.description,
              withoutBottomHandle:
                originalSteps.some(({ id }) => id === step.label && id !== step.id) || subscriberGraph
                  ? false
                  : index === steps.length - 1,
              isLarge: step.isLarge,
            },
          };
        });

        nodes = [...nodes, ...newNodes];

        const edgeSteps = [...steps].slice(0, -1);

        const newEdges = edgeSteps.map((step: any, index: number) => ({
          id: `e${step.id}-${steps[index + 1].id}`,
          source: step.id,
          target: steps[index + 1].id,
          ...defaultEdgeOptions,
        }));

        const firstEdgeStep = steps[0];
        const lastEdgeStep = steps[steps.length - 1];

        const connectingEdge =
          connectingStepId === firstEdgeStep.id
            ? []
            : [
                {
                  id: `e${connectingStepId}-${firstEdgeStep.id}`,
                  source: connectingStepId,
                  target: firstEdgeStep.id,
                  ...defaultEdgeOptions,
                },
              ];

        const lastEdge = originalSteps.some(({ id }) => id === lastEdgeStep.label && id !== lastEdgeStep.id)
          ? [
              {
                id: `e${lastEdgeStep.id}-${connectingStepId}`,
                source: lastEdgeStep.id,
                target: connectingStepId,
                ...defaultEdgeOptions,
              },
            ]
          : [];

        edges = [...edges, ...connectingEdge, ...newEdges, ...lastEdge];
      }
    }
  }
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};
