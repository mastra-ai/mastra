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
} from '@mastra/playground-ui';

function Agents() {
  const { Link } = useLinkComponent();
  const { data: agents = {}, isLoading, error } = useAgents();

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
          <Button variant="ghost" size="md" as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
            <DocsIcon />
            Agents documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable agents={agents} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export { Agents };

export default Agents;
