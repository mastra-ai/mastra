import type { GetWorkflowResponse } from '@mastra/client-js';
import { WorkflowGraphCanvas } from '@mastra/playground-ui/components/Workflow';
import { useNodesState, useEdgesState } from '@xyflow/react';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { useSuspendedStepKey, useWaitingStepKey } from './use-workflow-trigger';
import { constructNodesAndEdges, findFocusNode } from './utils';
import type { WorkflowGraphEdge, WorkflowGraphNode } from './utils';

export interface WorkflowGraphInnerProps {
  workflow: Pick<GetWorkflowResponse, 'stepGraph'>;
}

export function WorkflowGraphInner({ workflow }: WorkflowGraphInnerProps) {
  const { nodes: initialNodes, edges: initialEdges } = constructNodesAndEdges(workflow);
  const [nodes, , onNodesChange] = useNodesState<WorkflowGraphNode>(initialNodes);
  const [edges] = useEdgesState<WorkflowGraphEdge>(initialEdges);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges });
  const { selectedStepId } = useWorkflowSelectedStep();
  const waitingStepKey = useWaitingStepKey();
  const suspendedStepKey = useSuspendedStepKey();
  const focusStepId = selectedStepId ?? waitingStepKey ?? suspendedStepKey;
  const focusNodeId = focusStepId ? findFocusNode(nodes, focusStepId)?.id : undefined;

  return (
    <WorkflowGraphCanvas
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      focusNodeId={focusNodeId}
    />
  );
}
