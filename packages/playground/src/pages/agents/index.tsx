import { Header, HeaderTitle, MainContentLayout, MainContentContent } from '@mastra/playground-ui';

import { useAgents } from '@/hooks/use-agents';
import { AgentsTable } from '@mastra/playground-ui';

function Agents() {
  const { data: agents, isLoading } = useAgents();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Agents</HeaderTitle>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable agents={agents} isLoading={isLoading} computeLink={agentId => `/agents/${agentId}/chat/new`} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Agents;
