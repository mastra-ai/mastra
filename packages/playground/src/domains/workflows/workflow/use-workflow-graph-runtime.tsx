import type { Edge, NodeProps } from '@xyflow/react';
import { useMemo } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowGraphNode } from './workflow-graph-node';
import { WORKFLOW_STEP_NODE_TYPE } from './workflow-step-node-utils';
import type { WorkflowStepNode } from './workflow-step-node-utils';

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

const buildStepsFlow = (edges: Edge[]) =>
  edges.reduce(
    (acc, edge) => {
      if (!edge.data) {
        return acc;
      }

      const stepId = edge.data.nextStepId as string;
      const prevStepId = edge.data.previousStepId as string;

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
    }),
    [stepsFlow, workflowName],
  );
  const styledEdges = useMemo(
    () =>
      edges.map(edge => {
        const previousStepId = getScopedStepId(edge.data?.previousStepId as string | undefined, workflowName);
        const nextStepId = getScopedStepId(edge.data?.nextStepId as string | undefined, workflowName);

        return {
          ...edge,
          style: {
            ...edge.style,
            stroke:
              steps[previousStepId ?? '']?.status === 'success' && steps[nextStepId ?? '']
                ? '#22c55e'
                : edge.data?.conditionNode && !steps[previousStepId ?? ''] && Boolean(steps[nextStepId ?? '']?.status)
                  ? '#22c55e'
                  : undefined,
          },
        };
      }),
    [edges, steps, workflowName],
  );

  return { nodeTypes, stepsFlow, styledEdges };
};
