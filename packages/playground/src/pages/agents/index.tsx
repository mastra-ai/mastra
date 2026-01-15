import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  useLinkComponent,
  DocsIcon,
  useAgents,
  AgentsTable,
  AgentIcon,
  CreateAgentDialog,
} from '@mastra/playground-ui';

function Agents() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { Link, navigate, paths } = useLinkComponent();
  const { data: agents = {}, isLoading } = useAgents();

  const handleAgentCreated = (agentId: string) => {
    setIsCreateDialogOpen(false);
    navigate(`${paths.agentLink(agentId)}/chat`);
  };

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </HeaderTitle>

        <HeaderAction>
          <Button variant="light" onClick={() => setIsCreateDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Create Agent
          </Button>
          <Button variant="outline" as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Agents documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable agents={agents} isLoading={isLoading} onCreateClick={() => setIsCreateDialogOpen(true)} />
      </MainContentContent>

      <CreateAgentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleAgentCreated}
      />
    </MainContentLayout>
  );
}

export { Agents };
