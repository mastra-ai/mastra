import { Link } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  HeaderGroup,
  Button,
  DividerIcon,
  HeaderAction,
  Icon,
  DocsIcon,
  AgentIcon,
} from '@mastra/playground-ui';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/agents`}>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </Crumb>
        <Crumb as={Link} to={`/agents/${agentId}`} isCurrent>
          {agentName}
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <Button as={Link} to={`/agents/${agentId}/chat`}>
          Chat
        </Button>

        <DividerIcon />

        <Button as={Link} to={`/agents/${agentId}/traces`}>
          Traces
        </Button>
        <Button as={Link} to={`/agents/${agentId}/evals`}>
          Evals
        </Button>
      </HeaderGroup>

      <HeaderAction>
        <Button as={Link} to="https://mastra.ai/en/docs/agents/overview" target="_blank">
          <Icon>
            <DocsIcon />
          </Icon>
          Agents documentation
        </Button>
      </HeaderAction>
    </Header>
  );
}
