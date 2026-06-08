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

  const graphSource = snapshot?.serializedStepGraph ? { stepGraph: snapshot.serializedStepGraph } : workflow;

  return (
    <ReactFlowProvider>
      {/*
        React Flow's useNodesState/useEdgesState only seed from their initial value on mount, so
        switching runs of the same workflow (identical stepGraph) would otherwise keep the previous
        run's nodes/edges. `snapshot` is built in WorkflowLayout straight from the route param, so
        `snapshot.runId` is the synchronous, route-accurate signal: keying on it forces a fresh
        mount per selected run (and resets to the un-run graph on /graph).
      */}
      <WorkflowGraphInner key={snapshot?.runId ?? 'no-run'} workflow={graphSource} />
    </ReactFlowProvider>
  );
}
