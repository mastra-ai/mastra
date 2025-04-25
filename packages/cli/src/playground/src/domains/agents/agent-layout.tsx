import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

import { AgentHeader } from './agent-header';
import { HeaderTitle, Header } from '@mastra/playground-ui';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  return (
    <div className="h-full overflow-hidden">
      {isAgentLoading ? (
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      ) : (
        <AgentHeader agentName={agent?.name!} agentId={agentId!} />
      )}
      {children}
    </div>
  );
};
