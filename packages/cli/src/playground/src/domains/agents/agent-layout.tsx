import { useParams } from 'react-router';

// import { Skeleton } from '@/components/ui/skeleton';
// import { useAgent } from '@/hooks/use-agents';
// import { AgentHeaderOld } from './agent-header-old';
import {
  // HeaderTitle, Header,
  MainLayout,
  MainHeader,
} from '@mastra/playground-ui';
import { AgentHeader } from '@/domains/agents/agent-header';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  // const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  return (
    <MainLayout variant="2x2grid">
      <AgentHeader agentId={agentId!} />
      {/* <MainHeader width="full" className="sticky top-0 bg-surface1 z-[100]">
        <AgentHeader agentId={agentId!} />
      </MainHeader> */}
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
