import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { MastraResizablePanel } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { WorkflowLogsWrapper } from '../workflow/components/workflow-logs-wrapper';
import { useState } from 'react';

export interface WorkflowGraphLayoutProps {
  children: React.ReactNode;
}

export const WorkflowGraphLayout = ({ children }: WorkflowGraphLayoutProps) => {
  const { workflowId } = useParams();
  const [runId, setRunId] = useState<string | undefined>(undefined);

  return (
    <main className="flex-1 relative divide-x flex w-full h-full overflow-y-auto">
      <div className="min-w-[325px] grow relative">
        {children}
        {runId && <WorkflowLogsWrapper runId={runId} />}
      </div>
      <MastraResizablePanel
        defaultWidth={20}
        minimumWidth={20}
        maximumWidth={60}
        className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-surface3 [&>div:first-child]:-left-[1px] [&>div:first-child]:-right-[1px] [&>div:first-child]:w-[1px] [&>div:first-child]:bg-[#424242] [&>div:first-child]:hover:w-[2px] [&>div:first-child]:active:w-[2px]"
      >
        <WorkflowInformation workflowId={workflowId!} onTrigger={setRunId} />
      </MastraResizablePanel>
    </main>
  );
};
