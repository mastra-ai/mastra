import { WorkflowLogs } from '@/domains/workflows/workflow-logs';

export interface WorkflowLogsWrapperProps {
  runId: string;
}

export function WorkflowLogsWrapper({ runId }: WorkflowLogsWrapperProps) {
  return (
    <div className="fixed bottom-3 max-w-4xl rounded-t-lg w-full left-1/2 -translate-x-1/2 overflow-y-auto h-1/4 bg-surface3 border-t-sm border-r-sm border-l-sm border-border1">
      <WorkflowLogs runId={runId} />
    </div>
  );
}
