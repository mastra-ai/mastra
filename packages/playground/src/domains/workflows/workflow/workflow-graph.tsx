import type { GetWorkflowResponse } from '@mastra/client-js';
import { lodashTitleCase } from '@mastra/playground-ui';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircleIcon } from 'lucide-react';
import { useContext } from 'react';
import { WorkflowStepDetailPanel } from '../components/workflow-step-detail';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowSelectedStepProvider } from '../context/workflow-selected-step-context';
import { WorkflowStepDetailProvider } from '../context/workflow-step-detail-provider';
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
      <WorkflowSelectedStepProvider>
        <WorkflowStepDetailProvider>
          <div className="flex h-full w-full min-h-0">
            <div className="relative min-w-0 flex-1">
              <WorkflowGraphInner
                workflow={snapshot?.serializedStepGraph ? { stepGraph: snapshot?.serializedStepGraph } : workflow}
              />
            </div>
            <WorkflowStepDetailPanel />
          </div>
        </WorkflowStepDetailProvider>
      </WorkflowSelectedStepProvider>
    </ReactFlowProvider>
  );
}
