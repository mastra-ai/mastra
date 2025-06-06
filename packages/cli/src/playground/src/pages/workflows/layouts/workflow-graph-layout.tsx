import { WorkflowInformation } from '@/domains/workflows/workflow-information';

import { useParams } from 'react-router';

import { useState } from 'react';
import { WorkflowLogsContainer } from '@/domains/workflows/workflow-logs-container';

export interface WorkflowGraphLayoutProps {
  children: React.ReactNode;
}

export const WorkflowGraphLayout = ({ children }: WorkflowGraphLayoutProps) => {
  const { workflowId } = useParams();
  const [runId, setRunId] = useState<string | undefined>(undefined);

  return (
    <main className="flex-1 relative divide-x flex w-full h-full overflow-y-auto">
      <div className="min-w-[325px] grow relative">{children}</div>

      {runId && <WorkflowLogsContainer runId={runId} />}
      <div className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-surface3">
        <WorkflowInformation workflowId={workflowId!} onTrigger={setRunId} />
      </div>
    </main>
  );
};
