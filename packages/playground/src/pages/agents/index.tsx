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
  useIsCmsAvailable,
  usePermissions,
} from '@mastra/playground-ui';

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
            <Button variant="light" as={Link} to="/cms/agents/create">
              <Icon>
                <Plus />
              </Icon>
              Create an agent
            </Button>
          )}
          <Button variant="outline" as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
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
