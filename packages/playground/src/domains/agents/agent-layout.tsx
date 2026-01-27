import { useParams } from 'react-router';

import { AgentHeader } from './agent-header';
import { HeaderTitle, Header, MainContentLayout, useAgent, Skeleton } from '@mastra/playground-ui';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const { isLoading: isAgentLoading } = useAgent(agentId!);
  return (
    <MainContentLayout>
      {isAgentLoading ? (
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      ) : (
        <AgentHeader agentId={agentId!} />
      )}
      {children}
    </MainContentLayout>
  );
};
