import { WorkflowBoundaryNode, WORKFLOW_DATA_EDGE_TYPE } from '@mastra/playground-ui/components/Workflow';

import type { EdgeProps, NodeProps } from '@xyflow/react';
import { useContext, useMemo } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { groupWorkflowEdgeData } from './data/workflow-edge-data-groups';
import { buildStepsFlow } from './utils';
import type { WorkflowGraphEdge } from './utils';
import { getWorkflowBoundaryData } from './workflow-boundary-data';
import { WorkflowDataEdge } from './workflow-data-edge';
import { WorkflowGraphNode } from './workflow-graph-node';
import { WORKFLOW_BOUNDARY_NODE_TYPE, WORKFLOW_STEP_NODE_TYPE } from './workflow-step-node-utils';
import type { WorkflowBoundaryNode as WorkflowBoundaryNodeType, WorkflowStepNode } from './workflow-step-node-utils';

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

export const useWorkflowGraphRuntime = ({
  edges,
  workflowName,
}: {
  edges: WorkflowGraphEdge[];
  workflowName?: string;
}) => {
  const { steps } = useCurrentRun();
  const workflowRun = useContext(WorkflowRunContext);
  const workflowSucceeded = workflowName
    ? steps[workflowName]?.status === 'success' || getWorkflowBoundaryData(steps, workflowName).output !== undefined
    : workflowRun.result?.status === 'success';
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
      [WORKFLOW_DATA_EDGE_TYPE]: (props: EdgeProps<WorkflowGraphEdge>) => (
        <WorkflowDataEdge parentWorkflowName={workflowName} {...props} />
      ),
    }),
    [workflowName],
  );
  const styledEdges = useMemo(
    () =>
      groupWorkflowEdgeData(edges).map(edge => {
        const previousStepId = getScopedStepId(edge.data?.previousStepId, workflowName);
        const nextStepId = getScopedStepId(edge.data?.nextStepId, workflowName);
        const previousStepSucceeded = steps[previousStepId ?? '']?.status === 'success';
        const nextStepStatus = steps[nextStepId ?? '']?.status;
        let isFinishedEdge = previousStepSucceeded && nextStepStatus !== 'skipped';
        if (edge.data?.boundaryPayload === 'workflow-output') {
          isFinishedEdge = workflowSucceeded;
        } else if (edge.data?.boundaryPayload === 'workflow-input' || edge.data?.conditionNode) {
          isFinishedEdge = Boolean(nextStepStatus) && nextStepStatus !== 'skipped';
        }

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
