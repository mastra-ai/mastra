import { Link, useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useAgent } from '@/hooks/use-agents';

import { AgentHeader } from './agent-header';
import { HeaderTitle, Header, MainContentLayout, MainLayout, MainHeader, MainNavbar } from '@mastra/playground-ui';
import { useNewUI } from '@/hooks/use-new-ui';

export const AgentLayout = ({ children }: { children: React.ReactNode }) => {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);
  const newUIEnabled = useNewUI();

  return newUIEnabled ? (
    <MainLayout>
      <MainHeader>
        <MainNavbar
          linkComponent={Link}
          breadcrumbItems={[
            { label: 'Agents', to: '/agents' },
            { label: agent?.name || '', to: `/agents/${agentId}/chat`, isCurrent: true },
          ]}
          navItems={[
            [{ label: 'Chat', to: `/agents/${agentId}/chat` }],
            [
              { label: 'Traces', to: `/agents/${agentId}/traces` },
              { label: 'Evals', to: `/agents/${agentId}/evals` },
            ],
          ]}
        />
      </MainHeader>
      {children}
    </MainLayout>
  ) : (
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
