import { useAgents } from '@/hooks/use-agents';
import { MainContentLayout, Header, HeaderTitle, MainContentContent, ToolList } from '@mastra/playground-ui';

import { useTools } from '@/hooks/use-all-tools';

export default function Tools() {
  const { data: agentsRecord, isLoading: isLoadingAgents } = useAgents();
  const { tools, isLoading: isLoadingTools } = useTools();

  const isEmpty = !isLoadingTools && Object.keys(tools).length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Tools</HeaderTitle>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <ToolList
          tools={tools}
          agents={agentsRecord}
          isLoading={isLoadingAgents || isLoadingTools}
          computeLink={(toolId, agentId) => (agentId ? `/tools/${agentId}/${toolId}` : `/tools/all/${toolId}`)}
          computeAgentLink={(_, agentId) => `/agents/${agentId}/chat`}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}
