import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

import { AgentHeaderOld } from './agent-header-old';
import { HeaderTitle, Header, MainLayout } from '@mastra/playground-ui';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  return (
    <MainLayout>
      <div />
      {/* {isAgentLoading ? (
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      ) : (
        <AgentHeaderOld agentName={agent?.name!} agentId={agentId!} />
      )} */}
      {children}
    </MainLayout>
  );
};
