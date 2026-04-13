import type { GetWorkflowResponse } from '@mastra/client-js';
import { Skeleton, lodashTitleCase } from '@mastra/playground-ui';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircleIcon } from 'lucide-react';
import { useContext } from 'react';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowGraphInner } from './workflow-graph-inner';
import '../../../index.css';

export interface WorkflowGraphProps {
  workflowId: string;
  isLoading?: boolean;
  workflow?: GetWorkflowResponse;
}

export function WorkflowGraph({ workflowId, workflow, isLoading }: WorkflowGraphProps) {
  const { snapshot } = useContext(WorkflowRunContext);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-full" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-2">
          <AlertCircleIcon />
          <div>We couldn&apos;t find {lodashTitleCase(workflowId)} workflow.</div>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkflowGraphInner
        workflow={snapshot?.serializedStepGraph ? { stepGraph: snapshot?.serializedStepGraph } : workflow}
      />
    </ReactFlowProvider>
  );
}
