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
  AgentCombobox,
} from '@mastra/playground-ui';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/agents`} isCurrent>
          <Icon>
            <AgentIcon />
          </Icon>
          Agents
        </Crumb>
      </Breadcrumb>

      <HeaderGroup>
        <div className="w-[240px]">
          <AgentCombobox value={agentId} />
        </div>

        <DividerIcon />

        <Button as={Link} to={`/agents/${agentId}/chat`}>
          Chat
        </Button>

        <DividerIcon />

        <Button as={Link} to={`/observability?entity=${agentId}`}>
          Traces
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
