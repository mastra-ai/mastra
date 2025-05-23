import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AgentCoinIcon,
  AgentIcon,
  Button,
  DataTable,
  EmptyState,
  Header,
  HeaderTitle,
  Icon,
} from '@mastra/playground-ui';

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

  if (isLoading) return null;

  return (
    <section className="overflow-hidden h-full">
      <Header>
        <HeaderTitle>Agents</HeaderTitle>
      </Header>

      {agentListData.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <EmptyState
            iconSlot={<AgentCoinIcon />}
            titleSlot="Configure Agents"
            descriptionSlot="Mastra agents are not configured yet. You can find more information in the documentation."
            actionSlot={
              <Button
                size="lg"
                className="w-full"
                variant="light"
                as="a"
                href="https://mastra.ai/en/docs/agents/overview"
                target="_blank"
              >
                <Icon>
                  <AgentIcon />
                </Icon>
                Docs
              </Button>
            }
          />
        </div>
      ) : (
        <ScrollArea className="h-full">
          <DataTable
            columns={agentsTableColumns}
            data={agentListData}
            onClick={row => navigate(`/agents/${row.id}/chat`)}
          />
        </ScrollArea>
      )}
    </section>
  );
}

export default Agents;
