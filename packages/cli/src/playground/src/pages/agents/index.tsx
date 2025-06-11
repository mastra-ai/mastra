import {
  AgentCoinIcon,
  AgentIcon,
  Button,
  DataTable,
  EmptyState,
  Icon,
  MainLayout,
  MainContent,
  MainHeader,
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

  const extendedAgentListData = Array.from({ length: 7 }, (_, i) =>
    agentListData.map(item => ({
      ...item,
      name: `${item.name} Copy ${i + 1}`,
    })),
  ).flat();

  if (isLoading) return null;

  return (
    <MainLayout>
      {/* <div style={{ border: '1px solid red' }}>asdfads</div>
      <div style={{ border: '1px solid red' }}>asdfasdfas</div> */}
      <MainHeader>
        <AgentIcon /> Agents
      </MainHeader>

      {agentListData.length === 0 ? (
        <MainContent isCentered={true}>
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
        </MainContent>
      ) : (
        <MainContent>
          <DataTable
            columns={agentsTableColumns}
            data={extendedAgentListData}
            onClick={row => navigate(`/agents/${row.id}/chat`)}
          />
        </MainContent>
      )}
    </MainLayout>
  );
}

export default Agents;
