import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { useMemo } from 'react';
import { useWorkflowSelectedStep } from '../context/use-workflow-selected-step';
import { useWorkflowGraphNodes } from './use-workflow-graph-nodes';
import { useWorkflowGraphRuntime } from './use-workflow-graph-runtime';
import { findFocusNode } from './utils';
import { getWorkflowGraphGroups } from './workflow-graph-groups';
import { WorkflowGraphCanvas } from '@/ds/components/Workflow';

export interface WorkflowGraphInnerProps {
  stepGraph: SerializedStepFlowEntry[];
  requestContext: Record<string, any>;
}

export function WorkflowGraphInner({ stepGraph, requestContext }: WorkflowGraphInnerProps) {
  const { nodes, edges, onNodesChange } = useWorkflowGraphNodes(stepGraph);
  const { edgeTypes, nodeTypes, styledEdges } = useWorkflowGraphRuntime({ edges, requestContext });
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
