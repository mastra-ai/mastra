import type { Edge, EdgeProps, NodeProps } from '@xyflow/react';
import { useContext, useMemo } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowBoundaryNode } from './workflow-boundary-node';
import { WorkflowDataEdge, WORKFLOW_DATA_EDGE_TYPE } from './workflow-data-edge';
import { WorkflowGraphNode } from './workflow-graph-node';
import { WORKFLOW_BOUNDARY_NODE_TYPE, WORKFLOW_STEP_NODE_TYPE } from './workflow-step-node-utils';
import type { WorkflowBoundaryNode as WorkflowBoundaryNodeType, WorkflowStepNode } from './workflow-step-node-utils';
import { buildStepsFlow } from './utils';

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

export const useWorkflowGraphRuntime = ({ edges, workflowName }: { edges: Edge[]; workflowName?: string }) => {
  const { steps } = useCurrentRun();
  const workflowRun = useContext(WorkflowRunContext);
  const workflowSucceeded = workflowRun.result?.status === 'success';
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
        const previousStepSucceeded = steps[previousStepId ?? '']?.status === 'success';
        const nextStepStatus = steps[nextStepId ?? '']?.status as string | undefined;
        // The boundary edge into the End node carries no step ids; it should light
        // green once the whole workflow run has finished successfully.
        if (edge.data?.boundaryPayload === 'workflow-output') {
          const isFinishedEdge = workflowSucceeded;

          return {
            ...edge,
            type: WORKFLOW_DATA_EDGE_TYPE,
            animated: isFinishedEdge ? false : edge.animated,
            data: { ...edge.data, edgeStatus: isFinishedEdge ? 'success' : 'idle' },
            style: {
              ...edge.style,
              stroke: isFinishedEdge ? '#22c55e' : '#8e8e8e',
              strokeDasharray: isFinishedEdge ? 'none' : edge.style?.strokeDasharray,
            },
          };
        }
        // A conditional arm edge must only light when that specific arm was actually taken — i.e.
        // the arm step has run (any status other than the un-taken `skipped`). Lighting it purely
        // off the shared predecessor would falsely show the un-taken branch as active, since both
        // arms share the same (successful) condition predecessor.
        if (edge.data?.conditionNode) {
          const armTaken = Boolean(nextStepStatus) && nextStepStatus !== 'skipped';
          const isFinishedEdge = armTaken;

          return {
            ...edge,
            type: WORKFLOW_DATA_EDGE_TYPE,
            animated: isFinishedEdge ? false : edge.animated,
            data: { ...edge.data, edgeStatus: isFinishedEdge ? 'success' : 'idle' },
            style: {
              ...edge.style,
              stroke: isFinishedEdge ? '#22c55e' : '#8e8e8e',
              strokeDasharray: isFinishedEdge ? 'none' : edge.style?.strokeDasharray,
            },
          };
        }
        // A normal edge is green when data flowed out of a successful predecessor; the next step's
        // own running/idle state does not matter, so the taken path stays continuous mid-run. The
        // only suppression is an explicitly `skipped` next step (the un-taken arm of a resolved
        // conditional reached through a non-condition edge).
        const isFinishedEdge = previousStepSucceeded && nextStepStatus !== 'skipped';

        return {
          ...edge,
          type: WORKFLOW_DATA_EDGE_TYPE,
          animated: isFinishedEdge ? false : edge.animated,
          data: {
            ...edge.data,
            edgeStatus: isFinishedEdge ? 'success' : 'idle',
          },
          style: {
            ...edge.style,
            stroke: isFinishedEdge ? '#22c55e' : '#8e8e8e',
            strokeDasharray: isFinishedEdge ? 'none' : edge.style?.strokeDasharray,
          },
        };
      }),
    [edges, steps, workflowName, workflowSucceeded],
  );

  return { edgeTypes, nodeTypes, stepsFlow, styledEdges };
};
