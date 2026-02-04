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
  useExperimentalFeatures,
} from '@mastra/playground-ui';

function Agents() {
  const { Link, navigate } = useLinkComponent();
  const { data: agents = {}, isLoading } = useAgents();
  const { experimentalFeaturesEnabled } = useExperimentalFeatures();

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
          {experimentalFeaturesEnabled && (
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
          onCreateClick={experimentalFeaturesEnabled ? handleCreateClick : undefined}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export { Agents };

export default Agents;
