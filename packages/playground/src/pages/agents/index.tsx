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
  AgentIcon,
} from '@mastra/playground-ui';
import { useAgents, AgentsTable } from '@mastra/playground-ui/agents';
import { useIsCmsAvailable } from '@mastra/playground-ui/cms';
import { usePermissions } from '@mastra/playground-ui/auth';
import { Plus } from 'lucide-react';

function Agents() {
  const { Link, navigate } = useLinkComponent();
  const { data: agents = {}, isLoading, error } = useAgents();
  const { isCmsAvailable } = useIsCmsAvailable();
  const { canEdit } = usePermissions();

  const canCreateAgent = isCmsAvailable && canEdit('stored-agents');

  const handleCreateClick = () => {
    navigate('/cms/agents/create');
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
          {canCreateAgent && (
            <Button as={Link} to="/cms/agents/create">
              <Plus />
              Create an agent
            </Button>
          )}
          <Button variant="ghost" size="md" as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
            <DocsIcon />
            Agents documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable
          agents={agents}
          isLoading={isLoading}
          error={error}
          onCreateClick={canCreateAgent ? handleCreateClick : undefined}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export { Agents };

export default Agents;
