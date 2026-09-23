import type { GetWorkflowResponse } from '@mastra/client-js';
import { WorkflowGraphPlaceholder } from '@mastra/playground-ui/components/Workflow';
import { lodashTitleCase } from '@mastra/playground-ui/utils/string';
import { ReactFlowProvider } from '@xyflow/react';
import { useContext, useMemo } from 'react';
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
  const stepGraph = runSnapshot?.serializedStepGraph ?? snapshot?.serializedStepGraph ?? workflow?.stepGraph;
  const layoutKey = useMemo(() => `${workflowId}:${JSON.stringify(stepGraph)}`, [workflowId, stepGraph]);

  if (isLoading) return <WorkflowGraphPlaceholder isLoading />;
  if (!workflow || !stepGraph) return <WorkflowGraphPlaceholder workflowName={lodashTitleCase(workflowId)} />;

  return (
    <ReactFlowProvider key={layoutKey}>
      <WorkflowGraphBoundary stepGraph={stepGraph}>
        <WorkflowGraphInner stepGraph={stepGraph} />
      </WorkflowGraphBoundary>
    </ReactFlowProvider>
  );
}
