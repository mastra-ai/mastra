import { Skeleton } from '@/ds/components/Skeleton';

import '../../../index.css';

import { lodashTitleCase } from '@/lib/string';
import { AlertCircleIcon } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { WorkflowGraphInner } from './workflow-graph-inner';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useContext } from 'react';
import { GetWorkflowResponse } from '@mastra/client-js';

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
