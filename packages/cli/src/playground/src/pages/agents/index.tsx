import { ScrollArea } from '@/components/ui/scroll-area';
import { DataTable, Header, HeaderTitle } from '@mastra/playground-ui';

import { useAgents } from '@/hooks/use-agents';
import { agentsTableColumns } from '@/domains/agents/table.columns';

function Agents() {
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
        <DataTable isLoading={isLoading} columns={agentsTableColumns} data={agentListData} />
      </ScrollArea>
    </section>
  );
}

export default Agents;
