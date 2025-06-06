import { WorkflowInformation } from '@/domains/workflows/workflow-information';

import { useParams } from 'react-router';

import { useState } from 'react';
import { WorkflowLogs } from '@/domains/workflows/workflow-logs';
import { Header } from '@mastra/playground-ui';
import { useSidebar } from '@/components/ui/sidebar';
import clsx from 'clsx';

export interface WorkflowGraphLayoutProps {
  children: React.ReactNode;
}

export const WorkflowGraphLayout = ({ children }: WorkflowGraphLayoutProps) => {
  const { open } = useSidebar();
  const { workflowId } = useParams();
  const [runId, setRunId] = useState<string | undefined>(undefined);

  return (
    <main className="flex-1 relative divide-x flex w-full h-full overflow-y-auto">
      <div className="min-w-[325px] grow relative">{children}</div>

      {runId && (
        <div
          className={clsx(
            'fixed bottom-3 rounded-t-lg right-[342px] overflow-y-auto h-1/4 bg-surface3 border-t-sm border-r-sm border-l-sm border-border1',
            open ? 'left-44' : 'left-16',
          )}
        >
          <Header>Logs</Header>
          <WorkflowLogs runId={runId} />
        </div>
      )}
      <div className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-surface3">
        <WorkflowInformation workflowId={workflowId!} onTrigger={setRunId} />
      </div>
    </main>
  );
};
