import { NavLink } from 'react-router';

import { Header, Breadcrumb, Crumb, HeaderGroup, Button } from '@mastra/playground-ui';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  return (
    <Header>
      <Breadcrumb>
        <Crumb as={NavLink} href={`/agents`}>
          Agents
        </Crumb>
        <Crumb as={NavLink} href={`/agents/${agentId}`} isCurrent>
          {agentName}
        </Crumb>
        <HeaderGroup>
          <Button as={NavLink} href={`/agents/${agentId}/chat`}>
            Chat
          </Button>
          <Button as={NavLink} href={`/agents/${agentId}/traces`}>
            Traces
          </Button>
          <Button as={NavLink} href={`/agents/${agentId}/evals`}>
            Evals
          </Button>
        </HeaderGroup>
      </Breadcrumb>
    </Header>
  );
}
