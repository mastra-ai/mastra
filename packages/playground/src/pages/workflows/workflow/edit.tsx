import { useParams } from 'react-router';
import { Loader2, AlertCircle } from 'lucide-react';
import { WorkflowBuilder, useWorkflowDefinition } from '@mastra/playground-ui';

export function WorkflowEdit() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: definition, isLoading, error } = useWorkflowDefinition(workflowId);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface1">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-icon3" />
          <p className="text-sm text-icon3">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface1">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-red-500 font-medium">Failed to load workflow</p>
          <p className="text-xs text-icon3">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface1">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-amber-500" />
          <p className="text-sm text-icon3">Workflow not found</p>
        </div>
      </div>
    );
  }

  return <WorkflowBuilder definition={definition} workflowId={workflowId!} />;
}

export default WorkflowEdit;
