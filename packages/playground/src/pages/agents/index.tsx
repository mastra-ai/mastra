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
} from '@mastra/playground-ui';

import { useAgents } from '@/hooks/use-agents';
import { AgentsTable } from '@mastra/playground-ui';
import { AgentIcon } from '@mastra/playground-ui';

function Agents() {
  const { Link } = useLinkComponent();
  const { data: agents, isLoading } = useAgents();

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
          <Button as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Agents documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(agents || {}).length === 0}>
        <AgentsTable agents={agents} isLoading={isLoading} />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Agents;
