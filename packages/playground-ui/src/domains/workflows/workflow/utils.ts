import Dagre from '@dagrejs/dagre';
import type { StepCondition } from '@mastra/core/workflows';
import type { Node, Edge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';

export type ConditionConditionType = 'if' | 'else' | 'when' | 'until' | 'while';

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

export function extractConditions(group: StepCondition<any, any>, type: ConditionConditionType) {
  let result: Condition[] = [];
  if (!group) return result;

  function recurse(group: StepCondition<any, any>, conj?: 'and' | 'or' | 'not') {
    if (typeof group === 'string') {
      result.push({ type, fnString: group });
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
          type,
          ref,
          query: { [queryValue === true || queryValue === false ? 'is' : 'eq']: String(queryValue) },
          conj,
        });
      }
      if ('ref' in group) {
        const { ref, query } = group;
        result.push({ type, ref, query, conj });
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
      if ('not' in group) {
        recurse({ ...group.not }, 'not');
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

export const contructNodesAndEdges = ({
  stepGraph,
  stepSubscriberGraph,
  steps: mainSteps = {},
}: {
  stepGraph: any;
  stepSubscriberGraph: any;
  steps?: WStep;
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
  let allSteps: any[] = [];

  for (const [_index, _step] of initial.entries()) {
    const step = _step.step;
    const stepId = step.id;
    // let childrenNodes: Node[] = [];
    const steps = [_step, ...(stepsList?.[stepId] || [])]?.reduce((acc, step, i) => {
      const { stepGraph: stepWflowGraph, stepSubscriberGraph: stepWflowSubscriberGraph } =
        mainSteps[step.step.id] || {};
      const hasGraph = !!stepWflowGraph;

      const nodeId = nodes.some(node => node.id === step.step.id) ? `${step.step.id}-${i}` : step.step.id;

      let newStep = {
        ...step.step,
        label: step.step.id,
        originalId: step.step.id,
        type: hasGraph ? 'nested-node' : 'default-node',
        id: nodeId,
        stepGraph: stepWflowGraph,
        stepSubscriberGraph: stepWflowSubscriberGraph,
      };
      let conditionType: ConditionConditionType = 'when';
      if (step.config?.serializedWhen) {
        conditionType = step.step.id?.endsWith('_if') ? 'if' : step.step.id?.endsWith('_else') ? 'else' : 'when';
        const conditions = extractConditions(step.config.serializedWhen, conditionType);
        const conditionStep = {
          id: crypto.randomUUID(),
          conditions,
          type: 'condition-node',
          isLarge:
            (conditions?.length > 1 || conditions.some(({ fnString }) => !!fnString)) && conditionType !== 'else',
        };

        acc.push(conditionStep);
      }
      if (conditionType === 'if' || conditionType === 'else') {
        newStep = {
          ...newStep,
          label: conditionType === 'if' ? 'start if' : 'start else',
        };
      }
      newStep = {
        ...newStep,
        label: step.config?.loopLabel || newStep.label,
      };

      acc.push(newStep);

      return acc;
    }, []);

    allSteps = [...allSteps, ...steps];

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
          stepGraph: step.stepGraph,
          stepSubscriberGraph: step.stepSubscriberGraph,
        },
      };
    }) as Node[];

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

    let untilOrWhileConditionId: string | undefined;
    const loopResultSteps: { id: string; loopType: string }[] = [];
    let finishedLoopStep: any | undefined;
    let otherLoopStep: any | undefined;

    if (initial.length) {
      for (const [_index, _step] of initial.entries()) {
        const step = _step.step;
        const stepId = step.id;
        // let childrenNodes: Node[] = [];
        const steps = [_step, ...(stepsList?.[stepId] || [])]?.reduce((acc, step, i) => {
          const { stepGraph: stepWflowGraph, stepSubscriberGraph: stepWflowSubscriberGraph } =
            mainSteps[step.step.id] || {};
          const hasGraph = !!stepWflowGraph;
          const nodeId = nodes.some(node => node.id === step.step.id) ? `${step.step.id}-${i}` : step.step.id;

          let newStep = {
            ...step.step,
            originalId: step.step.id,
            label: step.step.id,
            type: hasGraph ? 'nested-node' : 'default-node',
            id: nodeId,
            stepGraph: stepWflowGraph,
            stepSubscriberGraph: stepWflowSubscriberGraph,
          };
          let conditionType: ConditionConditionType = 'when';
          const isFinishedLoop = step.config?.loopLabel?.endsWith('loop finished');
          if (step.config?.serializedWhen && !isFinishedLoop) {
            conditionType = step.step.id?.endsWith('_if')
              ? 'if'
              : step.step.id?.endsWith('_else')
                ? 'else'
                : (step.config?.loopType ?? 'when');

            const conditions = extractConditions(step.config.serializedWhen, conditionType);
            const conditionStep = {
              id: crypto.randomUUID(),
              conditions,
              type: 'condition-node',
              isLarge:
                (conditions?.length > 1 || conditions.some(({ fnString }) => !!fnString)) && conditionType !== 'else',
            };
            if (conditionType === 'until' || conditionType === 'while') {
              untilOrWhileConditionId = conditionStep.id;
            }

            acc.push(conditionStep);
          }
          if (isFinishedLoop) {
            const loopResultStep = {
              id: crypto.randomUUID(),
              type: 'loop-result-node',
              loopType: 'finished',
              loopResult: step.config.loopType === 'until' ? true : false,
            };
            loopResultSteps.push(loopResultStep);
            acc.push(loopResultStep);
          }
          if (!isFinishedLoop && step.config?.loopType) {
            const loopResultStep = {
              id: crypto.randomUUID(),
              type: 'loop-result-node',
              loopType: step.config.loopType,
              loopResult: step.config.loopType === 'until' ? false : true,
            };
            loopResultSteps.push(loopResultStep);
            acc.push(loopResultStep);
          }
          if (conditionType === 'if' || conditionType === 'else') {
            newStep = {
              ...newStep,
              label: conditionType === 'if' ? 'start if' : 'start else',
            };
          }
          if (step.config.loopType) {
            if (isFinishedLoop) {
              finishedLoopStep = newStep;
            } else {
              otherLoopStep = newStep;
            }
          }
          newStep = {
            ...newStep,
            loopType: isFinishedLoop ? 'finished' : step.config.loopType,
            label: step.config?.loopLabel || newStep.label,
          };
          acc.push(newStep);
          return acc;
        }, []);

        let afterStep: any = [];
        let afterStepStepList = connectingStepId?.includes('&&') ? connectingStepId.split('&&') : [];
        if (connectingStepId?.includes('&&')) {
          afterStep = [
            {
              id: connectingStepId,
              label: connectingStepId,
              type: 'after-node',
              steps: afterStepStepList,
            },
          ];
        }

        const newNodes = [...steps, ...afterStep].map((step: any, index: number) => {
          const subscriberGraph = stepSubscriberGraph?.[step.id];
          const withBottomHandle = step.originalId === connectingStepId || subscriberGraph;
          return {
            id: step.id,
            position: { x: _index * 300 + 300, y: index * 100 + 100 },
            type: step.type,
            data: {
              conditions: step.conditions,
              label: step.label,
              description: step.description,
              result: step.loopResult,
              loopType: step.loopType,
              steps: step.steps,
              withoutBottomHandle: withBottomHandle ? false : index === steps.length - 1,
              isLarge: step.isLarge,
              stepGraph: step.stepGraph,
              stepSubscriberGraph: step.stepSubscriberGraph,
            },
          };
        }) as Node[];

        nodes = [...nodes, ...newNodes].map(node => ({
          ...node,
          data: {
            ...node.data,
            withoutBottomHandle: afterStepStepList.includes(node.id) ? false : node.data.withoutBottomHandle,
          },
        }));

        const edgeSteps = [...steps].slice(0, -1);

        const firstEdgeStep = steps[0];
        const lastEdgeStep = steps[steps.length - 1];

        const afterEdges = afterStepStepList?.map((step: any) => ({
          id: `e${step}-${connectingStepId}`,
          source: step,
          target: connectingStepId,
          ...defaultEdgeOptions,
        }));

        const finishedLoopResult = loopResultSteps?.find(step => step.loopType === 'finished');

        const newEdges = edgeSteps
          .map((step: any, index: number) => ({
            id: `e${step.id}-${steps[index + 1].id}`,
            source: step.id,
            target: steps[index + 1].id,
            remove: finishedLoopResult?.id === steps[index + 1].id, //remove if target is a finished loop result
            ...defaultEdgeOptions,
          }))
          ?.filter((edge: any) => !edge.remove);
        const connectingEdge =
          connectingStepId === firstEdgeStep.id
            ? []
            : [
                {
                  id: `e${connectingStepId}-${firstEdgeStep.id}`,
                  source: connectingStepId,
                  target: firstEdgeStep.id,
                  remove: finishedLoopResult?.id === firstEdgeStep.id,
                  ...defaultEdgeOptions,
                },
              ]?.filter((edge: any) => !edge.remove); //remove if target is a finished loop result

        const lastEdge =
          lastEdgeStep.originalId === connectingStepId
            ? [
                {
                  id: `e${lastEdgeStep.id}-${connectingStepId}`,
                  source: lastEdgeStep.id,
                  target: connectingStepId,
                  ...defaultEdgeOptions,
                },
              ]
            : [];

        edges = [...edges, ...afterEdges, ...connectingEdge, ...newEdges, ...lastEdge];

        allSteps = [...allSteps, ...steps];
      }

      if (untilOrWhileConditionId && loopResultSteps.length && finishedLoopStep && otherLoopStep) {
        const loopResultStepsEdges = loopResultSteps.map(step => ({
          id: `e${untilOrWhileConditionId}-${step.id}`,
          source: untilOrWhileConditionId!,
          target: step.id,
          ...defaultEdgeOptions,
        }));

        const finishedLoopResult = loopResultSteps?.find(res => res.loopType === 'finished');
        const otherLoopResult = loopResultSteps?.find(res => res.loopType !== 'finished');

        const otherLoopEdge = {
          id: `e${otherLoopResult?.id}-${otherLoopStep?.id}`,
          source: otherLoopResult?.id!,
          target: otherLoopStep.id!,
          ...defaultEdgeOptions,
        };

        const finishedLoopEdge = {
          id: `e${finishedLoopResult?.id}-${finishedLoopStep?.id}`,
          source: finishedLoopResult?.id!,
          target: finishedLoopStep.id!,
          ...defaultEdgeOptions,
        };

        edges = [...edges, ...loopResultStepsEdges, otherLoopEdge, finishedLoopEdge];
      }
    }
  }
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges };
};
