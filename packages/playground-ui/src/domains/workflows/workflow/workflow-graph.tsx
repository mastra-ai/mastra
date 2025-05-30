import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';
import '../../../index.css';

import { lodashTitleCase } from '@/lib/string';
import { AlertCircleIcon } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { WorkflowGraphInner } from './workflow-graph-inner';
import { WorkflowNestedGraphProvider } from '../context/workflow-nested-graph-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { useContext } from 'react';

export interface WorkflowGraphProps {
  workflowId: string;
  onShowTrace: ({ runId, stepName }: { runId: string; stepName: string }) => void;
}

export function WorkflowGraph({ workflowId, onShowTrace }: WorkflowGraphProps) {
  const { workflow, isLoading } = useWorkflow(workflowId);
  const { snapshotStepGraph } = useContext(WorkflowRunContext);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
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

  console.log({ snapshotStepGraph, workflow: workflow.stepGraph });

  // if (snapshotStepGraph) {
  //   // if we only switch in workflow prop in WorkflowGraphInner, the change won't reflect in the node constructor
  //   return (
  //     <WorkflowNestedGraphProvider>
  //       <ReactFlowProvider>
  //         <WorkflowGraphInner workflow={{ stepGraph: snapshotStepGraph }} onShowTrace={onShowTrace} />
  //       </ReactFlowProvider>
  //     </WorkflowNestedGraphProvider>
  //   );
  // }

  return (
    <WorkflowNestedGraphProvider>
      <ReactFlowProvider>
        <WorkflowGraphInner
          workflow={snapshotStepGraph ? { stepGraph: snapshotStepGraph } : workflow}
          onShowTrace={onShowTrace}
        />
      </ReactFlowProvider>
    </WorkflowNestedGraphProvider>
  );
}
