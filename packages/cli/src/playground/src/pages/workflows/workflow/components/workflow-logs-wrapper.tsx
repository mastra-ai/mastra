import { WorkflowLogs } from '@/domains/workflows/workflow-logs';

export interface WorkflowLogsWrapperProps {
  runId: string;
}

export function WorkflowLogsWrapper({ runId }: WorkflowLogsWrapperProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 w-full overflow-y-auto h-1/4 bg-surface3 border-2 border-border1 border-red-500">
      <WorkflowLogs runId={runId} />
    </div>
  );
}
