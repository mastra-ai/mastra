import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { AgentHeader } from './agent-header';
import { HeaderTitle, Header, MainContentLayout, useAgent } from '@mastra/playground-ui';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId!);
  return (
    <MainContentLayout>
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
    </MainContentLayout>
  );
};
