import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable, Header, HeaderTitle } from '@mastra/playground-ui';

import { useAgents } from '@/hooks/use-agents';
import { agentsTableColumns } from '@/domains/agents/table.columns';
import { useNavigate } from 'react-router';

function Agents() {
  const navigate = useNavigate();
  const { agents, isLoading } = useAgents();

  const agentListData = Object.entries(agents).map(([key, agent]) => ({
    id: key,
    name: agent.name,
    description: agent.instructions,
    provider: agent?.provider,
    modelId: agent?.modelId,
  }));

  return (
    <section className="overflow-hidden">
      <Header>
        <HeaderTitle>Agents</HeaderTitle>
      </Header>

      <ScrollArea className="h-full">
        <DataTable
          isLoading={isLoading}
          columns={agentsTableColumns}
          data={agentListData}
          onClick={row => navigate(`/agents/${row.id}/chat`)}
        />
      </ScrollArea>
    </section>
  );
}

export default Agents;
