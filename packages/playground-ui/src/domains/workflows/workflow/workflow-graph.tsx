import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';
import '../../../index.css';

import { lodashTitleCase } from '@/lib/string';
import { AlertCircleIcon } from 'lucide-react';
import { ReactFlowProvider } from '@xyflow/react';
import { WorkflowGraphInner } from './workflow-graph-inner';
import { WorkflowNestedGraphProvider } from '../context/workflow-nested-graph-context';

export interface WorkflowGraphProps {
  workflowId: string;
  onShowTrace: ({ runId, stepName }: { runId: string; stepName: string }) => void;
}

export function WorkflowGraph({ workflowId, onShowTrace }: WorkflowGraphProps) {
  const { workflow, isLoading } = useWorkflow(workflowId);

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

  return (
    <WorkflowNestedGraphProvider>
      <ReactFlowProvider>
        <WorkflowGraphInner workflow={workflow} onShowTrace={onShowTrace} />
      </ReactFlowProvider>
    </WorkflowNestedGraphProvider>
  );
}
