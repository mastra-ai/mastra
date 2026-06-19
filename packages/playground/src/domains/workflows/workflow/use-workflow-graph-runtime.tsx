import type { Edge, EdgeProps, NodeProps } from '@xyflow/react';
import { useMemo } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowDataEdge, WORKFLOW_DATA_EDGE_TYPE } from './workflow-data-edge';
import { WorkflowBoundaryNode } from './workflow-boundary-node';
import { WorkflowGraphNode } from './workflow-graph-node';
import { WORKFLOW_BOUNDARY_NODE_TYPE, WORKFLOW_STEP_NODE_TYPE } from './workflow-step-node-utils';
import type { WorkflowBoundaryNode as WorkflowBoundaryNodeType, WorkflowStepNode } from './workflow-step-node-utils';

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

const buildStepsFlow = (edges: Edge[]) =>
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

export const useWorkflowGraphRuntime = ({ edges, workflowName }: { edges: Edge[]; workflowName?: string }) => {
  const { steps } = useCurrentRun();
  const stepsFlow = useMemo(() => buildStepsFlow(edges), [edges]);
  const nodeTypes = useMemo(
    () => ({
      [WORKFLOW_STEP_NODE_TYPE]: (props: NodeProps<WorkflowStepNode>) => (
        <WorkflowGraphNode parentWorkflowName={workflowName} {...props} stepsFlow={stepsFlow} />
      ),
      [WORKFLOW_BOUNDARY_NODE_TYPE]: (props: NodeProps<WorkflowBoundaryNodeType>) => (
        <WorkflowBoundaryNode {...props} />
      ),
    }),
    [stepsFlow, workflowName],
  );
  const edgeTypes = useMemo(
    () => ({
      [WORKFLOW_DATA_EDGE_TYPE]: (props: EdgeProps) => (
        <WorkflowDataEdge parentWorkflowName={workflowName} {...props} />
      ),
    }),
    [workflowName],
  );
  const styledEdges = useMemo(
    () =>
      edges.map(edge => {
        const previousStepId = getScopedStepId(edge.data?.previousStepId as string | undefined, workflowName);
        const nextStepId = getScopedStepId(edge.data?.nextStepId as string | undefined, workflowName);
        const isFinishedEdge =
          (steps[previousStepId ?? '']?.status === 'success' && Boolean(steps[nextStepId ?? ''])) ||
          (edge.data?.conditionNode && !steps[previousStepId ?? ''] && Boolean(steps[nextStepId ?? '']?.status));

        return {
          ...edge,
          type: WORKFLOW_DATA_EDGE_TYPE,
          animated: isFinishedEdge ? false : edge.animated,
          style: {
            ...edge.style,
            stroke: isFinishedEdge ? '#22c55e' : '#8e8e8e',
            strokeDasharray: isFinishedEdge ? 'none' : edge.style?.strokeDasharray,
          },
        };
      }),
    [edges, steps, workflowName],
  );

  return { edgeTypes, nodeTypes, stepsFlow, styledEdges };
};
