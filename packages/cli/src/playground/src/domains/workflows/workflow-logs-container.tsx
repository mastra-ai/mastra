import { useLogsByRunId } from '@/hooks/use-logs';
import { Header, Icon, LogsIcon, WorkflowLogs } from '@mastra/playground-ui';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

export interface WorkflowLogsContainerProps {
  runId: string;
}

export const WorkflowLogsContainer = ({ runId }: WorkflowLogsContainerProps) => {
  const [expanded, setExpanded] = useState(true);
  const { open } = useSidebar();
  const { data: logs = [], isLoading } = useLogsByRunId(runId);

  if (isLoading) return null;

  return (
    <div
      className={clsx(
        'fixed bottom-3 rounded-t-lg right-[342px] overflow-y-auto bg-surface3 border-t-sm border-r-sm border-l-sm border-border1 transition-all duration-300',
        expanded ? 'h-1/2' : 'h-content',
        open ? 'left-44' : 'left-16',
        'z-20',
      )}
    >
      <Header>
        <LogsIcon />
        <button
          className="text-left w-full h-full flex items-center justify-between"
          onClick={() => setExpanded(s => !s)}
        >
          Logs
          <Icon>
            <ChevronDown className={clsx('transition-transform -rotate-90 text-icon3', expanded ? 'rotate-0' : '')} />
          </Icon>
        </button>
      </Header>

      {expanded && <WorkflowLogs logs={logs} />}
    </div>
  );
};
