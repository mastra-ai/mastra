import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { WorkflowGraphCanvas } from '@mastra/playground-ui/components/Workflow';
import { useMemo } from 'react';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowGraphNodes } from './use-workflow-graph-nodes';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { findFocusNode } from './utils';
import { getWorkflowGraphGroups } from './workflow-graph-groups';

export interface WorkflowGraphInnerProps {
  stepGraph: SerializedStepFlowEntry[];
}

export function WorkflowGraphInner({ stepGraph }: WorkflowGraphInnerProps) {
  const { nodes, edges, onNodesChange } = useWorkflowGraphNodes(stepGraph);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges });
  const { selectedStepId } = useWorkflowSelectedStep();
  const focusNodeId = selectedStepId ? findFocusNode(nodes, selectedStepId)?.id : undefined;
  const groups = useMemo(() => getWorkflowGraphGroups(nodes), [nodes]);

  return (
    <WorkflowGraphCanvas
      groups={groups}
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      focusNodeId={focusNodeId}
    />
  );
}
