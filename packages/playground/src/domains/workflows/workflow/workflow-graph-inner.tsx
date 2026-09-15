import type { GetWorkflowResponse } from '@mastra/client-js';
import { WorkflowGraphCanvas } from '@mastra/playground-ui/components/Workflow';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowGraphNodes } from './use-workflow-graph-nodes';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { findFocusNode } from './utils';
import { getWorkflowGraphGroups } from './workflow-graph-groups';

export interface WorkflowGraphInnerProps {
  workflow: Pick<GetWorkflowResponse, 'stepGraph'>;
}

export function WorkflowGraphInner({ workflow }: WorkflowGraphInnerProps) {
  const { nodes, edges, onNodesChange } = useWorkflowGraphNodes(workflow.stepGraph);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges });
  const { selectedStepId } = useWorkflowSelectedStep();
  const focusNodeId = selectedStepId ? findFocusNode(nodes, selectedStepId)?.id : undefined;

  return (
    <WorkflowGraphCanvas
      groups={getWorkflowGraphGroups(nodes)}
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      focusNodeId={focusNodeId}
    />
  );
}
