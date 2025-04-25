import { Link } from 'react-router';

import { Header, Breadcrumb, Crumb, HeaderGroup, Button } from '@mastra/playground-ui';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={Link} to={`/agents`}>
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

        <Button as={Link} to={`/agents/${agentId}/traces`}>
          Traces
        </Button>
        <Button as={Link} to={`/agents/${agentId}/evals`}>
          Evals
        </Button>
      </HeaderGroup>
    </Header>
  );
}
