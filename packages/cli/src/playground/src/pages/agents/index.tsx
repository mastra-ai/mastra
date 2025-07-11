import { Header, HeaderTitle, MainContentLayout, MainContentContent } from '@mastra/playground-ui';

import { useAgents } from '@/hooks/use-agents';
import { useNavigate } from 'react-router';
import { AgentsTable } from '@mastra/playground-ui';

function Agents() {
  const navigate = useNavigate();
  const { agents, isLoading } = useAgents();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Agents</HeaderTitle>
      </Header>

      <MainContentContent>
        <AgentsTable
          agents={agents}
          isLoading={isLoading}
          onClickRow={agentId => navigate(`/agents/${agentId}/chat/new`)}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Agents;
