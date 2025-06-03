import { Skeleton } from '@/components/ui/skeleton';

import { useLegacyWorkflow } from '@/hooks/use-workflows';
import '../../../index.css';

import { LegacyWorkflowGraphInner } from './legacy-workflow-graph-inner';
import { lodashTitleCase } from '@/lib/string';
import { AlertCircleIcon } from 'lucide-react';
import { LegacyWorkflowNestedGraphProvider } from '../context/legacy-workflow-nested-graph-context';
import { ReactFlowProvider } from '@xyflow/react';

export function LegacyWorkflowGraph({ workflowId }: { workflowId: string }) {
  const { legacyWorkflow, isLoading } = useLegacyWorkflow(workflowId);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!legacyWorkflow) {
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
    <LegacyWorkflowNestedGraphProvider>
      <ReactFlowProvider>
        <LegacyWorkflowGraphInner workflow={legacyWorkflow} />
      </ReactFlowProvider>
    </LegacyWorkflowNestedGraphProvider>
  );
}
