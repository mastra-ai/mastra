import { useParams } from 'react-router';

import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

import { AgentHeader } from './agent-header';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {isAgentLoading ? (
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
      ) : (
        <AgentHeader agentName={agent?.name!} agentId={agentId!} />
      )}
      {children}
    </div>
  );
};
