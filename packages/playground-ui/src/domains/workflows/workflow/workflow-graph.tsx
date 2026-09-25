import type { GetWorkflowResponse } from '@mastra/client-js';
import { ReactFlowProvider } from '@xyflow/react';
import { useContext, useMemo } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowGraphBoundary } from './workflow-graph-boundary';
import { WorkflowGraphInner } from './workflow-graph-inner';
import { WorkflowGraphPlaceholder } from '@/ds/components/Workflow';
import { lodashTitleCase } from '@/utils/string';
import '../../../index.css';

export interface WorkflowGraphProps {
  workflowId: string;
  isLoading?: boolean;
  workflow?: GetWorkflowResponse;
  requestContext: Record<string, any>;
}

export function WorkflowGraph({ workflowId, workflow, isLoading, requestContext }: WorkflowGraphProps) {
  const { runSnapshot, snapshot } = useContext(WorkflowRunContext);
  const stepGraph = runSnapshot?.serializedStepGraph ?? snapshot?.serializedStepGraph ?? workflow?.stepGraph;
  const layoutKey = useMemo(() => `${workflowId}:${JSON.stringify(stepGraph)}`, [workflowId, stepGraph]);

  if (isLoading) return <WorkflowGraphPlaceholder isLoading />;
  if (!workflow || !stepGraph) return <WorkflowGraphPlaceholder workflowName={lodashTitleCase(workflowId)} />;

  return (
    <ReactFlowProvider key={layoutKey}>
      <WorkflowGraphBoundary stepGraph={stepGraph}>
        <WorkflowGraphInner stepGraph={stepGraph} requestContext={requestContext} />
      </WorkflowGraphBoundary>
    </ReactFlowProvider>
  );
}
