import {
  useLinkComponent,
  AgentCreateContent,
  MainContentLayout,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
} from '@mastra/playground-ui';

function CmsAgentsCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create an agent
        </HeaderTitle>
      </Header>
      <AgentCreateContent onSuccess={agent => navigate(`${paths.agentLink(agent.id)}/chat`)} />
    </MainContentLayout>
  );
}

export { CmsAgentsCreatePage };

export default CmsAgentsCreatePage;
