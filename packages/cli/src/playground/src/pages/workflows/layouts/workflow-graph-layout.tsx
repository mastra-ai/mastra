import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { MainContentContent } from '@mastra/playground-ui';
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
    <MainContentContent isDivided={true}>
      {children}
      {runId && <WorkflowLogsContainer runId={runId} />}
      <WorkflowInformation workflowId={workflowId!} onTrigger={setRunId} />
    </MainContentContent>
  );
};
