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
      const x = position.x - (node.measured?.width ?? 274) / 2;
      const y = position.y - (node.measured?.height ?? (node?.data?.isLarge ? 260 : 100)) / 2;

      return { ...node, position: { x, y } };
    }),
    edges,
    fullWidth,
    fullHeight,
  };
};

// const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
//   const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
//   g.setGraph({ rankdir: 'TB' });

//   edges.forEach(edge => g.setEdge(edge.source, edge.target));

//   nodes.forEach(node => {
//     const childrenNodes = nodes?.filter(_node => _node.parentId === node.id);
//     console.log(`children nodes of ${node.id} in node.forEach==`, childrenNodes);
//     return g.setNode(node.id, {
//       ...node,
//       width: (node.measured?.width ?? 274) * (childrenNodes?.length ?? 1),
//       height: (node.measured?.height ?? (node?.data?.isLarge ? 260 : 100)) * (childrenNodes?.length ?? 1),
//     });
//   });

//   Dagre.layout(g);

//   return {
//     nodes: nodes.map(node => {
//       const childrenNodes = nodes?.filter(_node => _node.parentId === node.id);
//       const position = g.node(node.id);
//       // We are shifting the dagre node position (anchor=center center) to the top left
//       // so it matches the React Flow node anchor point (top left).
//       console.log(`children nodes of ${node.id} in node.map==`, childrenNodes);
//       const width = (node.measured?.width ?? 274) * (childrenNodes?.length ?? 1);
//       const height = (node.measured?.height ?? (node?.data?.isLarge ? 260 : 100)) * (childrenNodes?.length ?? 1);
//       const x = position.x - width / 2;
//       const y = position.y - height / 2;

//       return {
//         ...node,
//         ...(node.type === 'nested-node'
//           ? {
//               measured: {
//                 width,
//                 height,
//               },
//             }
//           : {}),
//         position: { x, y },
//       };
//     }),
//     edges,
//   };
// };

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

// type ContructNodesAndEdgesProps = {
//   stepGraph: any;
//   stepSubscriberGraph: any;
//   steps?: WStep;
//   isNested?: never;
//   parentId?: never
// }

export const contructNodesAndEdges = ({
  stepGraph,
  stepSubscriberGraph,
  steps: mainSteps = {},
  parentId,
}: {
  stepGraph: any;
  stepSubscriberGraph: any;
  steps?: WStep;
  parentId?: string;
}): { nodes: Node[]; edges: Edge[]; allSteps: any[]; specialEdges?: Edge[] } => {
  if (!stepGraph) {
    return { nodes: [], edges: [], allSteps: [] };
  }
  const { initial, ...stepsList } = stepGraph;
  if (!initial.length) {
    return { nodes: [], edges: [], allSteps: [] };
  }

  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let allSteps: any[] = [];
  let specialEdges: Edge[] = [];

  for (const [_index, _step] of initial.entries()) {
    const step = _step.step;
    const stepId = step.id;
    const steps = [_step, ...(stepsList?.[stepId] || [])]?.reduce((acc, step, i) => {
      const { stepGraph: stepWflowGraph, stepSubscriberGraph: stepWflowSubscriberGraph } =
        mainSteps[step.step.id] || {};
      const hasGraph = !!stepWflowGraph;

      const nodeId = nodes.some(node => node.id === step.step.id) ? `${step.step.id}-${i}` : step.step.id;
      // let fullWidth = 274;
      // let fullHeight = 100;

      let childrenSteps: any[] = [];

      if (hasGraph) {
        const {
          // nodes: _nodes,
          specialEdges: childrenEdges,
          // fullWidth: _fullWidth,
          // fullHeight: _fullHeight,
          allSteps: _allSteps,
        } = contructNodesAndEdges({
          stepGraph: stepWflowGraph,
          stepSubscriberGraph: stepWflowSubscriberGraph,
          parentId: nodeId,
        });

        // const _allNodesWithParentId = _nodes.map(__node => ({
        //   ...__node,
        //   data: {
        //     ...__node.data,
        //     workflowName: step.step.id,
        //     parentId: nodeId,
        //   },
        // }));
        // childrenNodes = [...childrenNodes, ..._allNodesWithParentId];
        const _allStepsWithParentId = _allSteps.map(__step => ({
          ...__step,
          workflowName: step.step.id,
          parentId: nodeId,
        }));
        childrenSteps = [...childrenSteps, ..._allStepsWithParentId];
        edges = [...edges, ...(childrenEdges || [])];
        // fullWidth = _fullWidth as number;
        // fullHeight = _fullHeight as number;
      }

      let newStep = {
        ...step.step,
        label: step.step.id,
        originalId: step.step.id,
        type: 'default-node',
        id: parentId ? `${parentId}-${nodeId}` : nodeId,
        // height: fullHeight,
        // width: fullWidth,
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
      if (hasGraph) {
        acc.push(...childrenSteps);
      } else {
        acc.push(newStep);
      }

      return acc;
    }, []);

    allSteps = [...allSteps, ...steps];

    const newNodes = [...steps].map((step: any, index: number) => {
      const subscriberGraph = stepSubscriberGraph?.[step.id];

      return {
        id: step.id,
        position: { x: _index * 300 + (parentId ? 150 : 0), y: index * 100 },
        type: step.type,
        // measured: { height: step.isLarge ? 260 : (step.height ?? 100), width: step.width ?? 274 },
        // ...(parentId
        //   ? {
        //       parentId,
        //       extent: 'parent',
        //     }
        //   : {}),
        data: {
          conditions: step.conditions,
          label: step.label,
          description: step.description,
          withoutTopHandle: subscriberGraph?.[step.id] ? false : index === 0,
          withoutBottomHandle: subscriberGraph ? false : index === steps.length - 1,
          isLarge: step.isLarge,
          parentId: step.parentId,
          workflow: step.workflowName,
        },
      };
    }) as Node[];

    // nodes = [...nodes, ...newNodes];
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
    return { nodes: layoutedNodes, edges: layoutedEdges, allSteps };
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
        const steps = [_step, ...(stepsList?.[stepId] || [])]?.reduce((acc, step, i) => {
          const { stepGraph: stepWflowGraph, stepSubscriberGraph: stepWflowSubscriberGraph } =
            mainSteps[step.step.id] || {};
          const hasGraph = !!stepWflowGraph;
          const nodeId = nodes.some(node => node.id === step.step.id) ? `${step.step.id}-${i}` : step.step.id;

          // let fullWidth = 274;
          // let fullHeight = 100;

          let childrenSteps: any[] = [];

          if (hasGraph) {
            const {
              // nodes: _nodes,
              specialEdges: childrenEdges,
              // fullWidth: _fullWidth,
              // fullHeight: _fullHeight,
              allSteps: _allSteps,
            } = contructNodesAndEdges({
              stepGraph: stepWflowGraph,
              stepSubscriberGraph: stepWflowSubscriberGraph,
              parentId: nodeId,
            });

            // const _allNodesWithParentId = _nodes.map(__node => ({
            //   ...__node,
            //   data: {
            //     ...__node.data,
            //     workflowName: step.step.id,
            //     parentId: nodeId,
            //   },
            // }));
            // childrenNodes = [...childrenNodes, ..._allNodesWithParentId];
            // fullWidth = _fullWidth as number;
            // fullHeight = _fullHeight as number;
            const _allStepsWithParentId = _allSteps.map(__step => ({
              ...__step,
              workflowName: step.step.id,
              parentId: nodeId,
            }));
            childrenSteps = [...childrenSteps, ..._allStepsWithParentId];
            edges = [...edges, ...(childrenEdges || [])];
          }

          let newStep = {
            ...step.step,
            originalId: step.step.id,
            label: step.step.id,
            type: 'default-node',
            id: parentId ? `${parentId}-${nodeId}` : nodeId,
            // height: fullHeight,
            // width: fullWidth,
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
          if (hasGraph) {
            acc.push(...childrenSteps);
          } else {
            acc.push(newStep);
          }
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
            // measured: { height: step.isLarge ? 260 : (step.height ?? 100), width: step.width ?? 274 },
            // ...(parentId
            //   ? {
            //       parentId,
            //       extent: 'parent',
            //     }
            //   : {}),
            data: {
              conditions: step.conditions,
              label: step.label,
              description: step.description,
              result: step.loopResult,
              loopType: step.loopType,
              steps: step.steps,
              parentId: step.parentId,
              withoutBottomHandle: withBottomHandle ? false : index === steps.length - 1,
              isLarge: step.isLarge,
              workflow: step.workflowName,
            },
          };
        }) as Node[];

        // console.log('afterStepStepList==', afterStepStepList);
        const newAfterStepList = nodes
          ?.filter((node: any) => node.data.withoutBottomHandle && afterStepStepList?.includes(node.data.parentId))
          ?.map((node: any) => node.id);

        // console.log('newAfterStepList from node data', newAfterStepList);

        const _afterStepStepList = newAfterStepList?.length ? newAfterStepList : afterStepStepList;

        // console.log('latest after step steplist==', _afterStepStepList);

        nodes = [...nodes, ...newNodes].map(node => ({
          ...node,
          data: {
            ...node.data,
            withoutBottomHandle: _afterStepStepList.includes(node.id) ? false : node.data.withoutBottomHandle,
          },
        }));
        // nodes = [...nodes, ...newNodes, ...childrenNodes].map(node => ({
        //   ...node,
        //   data: {
        //     ...node.data,
        //     withoutBottomHandle: afterStepStepList.includes(node.id) ? false : node.data.withoutBottomHandle,
        //   },
        // }));

        const edgeSteps = [...steps].slice(0, -1);

        const firstEdgeStep = steps[0];
        const lastEdgeStep = steps[steps.length - 1];

        const afterEdges = _afterStepStepList?.map((step: any) => ({
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

      // lastNodeIds = nodes.filter(node => node?.data?.withoutBottomHandle).map(node => node?.id);
      // firstNodeIds = nodes.filter(node => node?.data?.withoutTopHandle).map(node => node?.id);
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
        specialEdges = [...specialEdges, ...loopResultStepsEdges, otherLoopEdge, finishedLoopEdge];
      }
    }
  }
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges);

  return { nodes: layoutedNodes, edges: layoutedEdges, allSteps, specialEdges };
};
