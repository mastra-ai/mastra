import {
  AgentIcon,
  Breadcrumb,
  Button,
  Crumb,
  DocsIcon,
  Header,
  HeaderAction,
  Icon,
  MainContentLayout,
} from '@mastra/playground-ui';
import { Link, useParams } from 'react-router';
import { AgentToolPanel } from '@/domains/agents/components/AgentToolPanel';

const AgentTool = () => {
  const { toolId, agentId } = useParams();

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/agents`}>
            <Icon>
              <AgentIcon />
            </Icon>
            Agents
          </Crumb>
          <Crumb as={Link} to={`/agents/${agentId}/chat`}>
            {agentId}
          </Crumb>
          <Crumb as={Link} to={`/tools/${agentId}/${toolId}`} isCurrent>
            {toolId}
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/docs/agents/using-tools" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Tools documentation
          </Button>
        </HeaderAction>
      </Header>

      <AgentToolPanel toolId={toolId!} agentId={agentId!} />
    </MainContentLayout>
  );
};

export default AgentTool;
