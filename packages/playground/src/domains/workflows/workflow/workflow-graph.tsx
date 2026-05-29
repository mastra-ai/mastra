import type { GetWorkflowResponse } from '@mastra/client-js';
import { Skeleton, lodashTitleCase } from '@mastra/playground-ui';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertCircleIcon } from 'lucide-react';
import { useContext } from 'react';
import { useParams } from 'react-router';
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
  const { runId } = useParams();

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

  // Keying on workflowId+runId forces ReactFlowProvider and WorkflowGraphInner
  // to remount on route change. Without this, useNodesState/useEdgesState only
  // read their initial value once and hold stale nodes from the previous route
  // when React Router reuses the component between same-pattern navigations.
  return (
    <ReactFlowProvider key={`${workflowId}-${runId ?? 'no-run'}`}>
      <WorkflowGraphInner
        workflow={snapshot?.serializedStepGraph ? { stepGraph: snapshot?.serializedStepGraph } : workflow}
      />
    </ReactFlowProvider>
  );
}
