import type { GetWorkflowResponse } from '@mastra/client-js';
import { WorkflowGraphPlaceholder } from '@mastra/playground-ui/components/Workflow';
import { lodashTitleCase } from '@mastra/playground-ui/utils/string';
import { ReactFlowProvider } from '@xyflow/react';
import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowGraphBoundary } from './workflow-graph-boundary';
import { WorkflowGraphInner } from './workflow-graph-inner';
import '../../../index.css';

export interface WorkflowGraphProps {
  workflowId: string;
  isLoading?: boolean;
  workflow?: GetWorkflowResponse;
}

export function WorkflowGraph({ workflowId, workflow, isLoading }: WorkflowGraphProps) {
  const { runSnapshot, snapshot } = useContext(WorkflowRunContext);

  if (isLoading) return <WorkflowGraphPlaceholder isLoading />;
  if (!workflow) return <WorkflowGraphPlaceholder workflowName={lodashTitleCase(workflowId)} />;

  const graph = { stepGraph: runSnapshot?.serializedStepGraph ?? snapshot?.serializedStepGraph ?? workflow.stepGraph };

  return (
    <ReactFlowProvider key={`${workflowId}:${JSON.stringify(graph.stepGraph)}`}>
      <WorkflowGraphBoundary stepGraph={graph.stepGraph}>
        <WorkflowGraphInner workflow={graph} />
      </WorkflowGraphBoundary>
    </ReactFlowProvider>
  );
}
