import { useAgent } from '@/hooks/use-agents';

import { MainTitle, Button, InnerNav, Breadcrumb, Crumb } from '@mastra/playground-ui';
import { AgentIcon } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';

import { Link } from 'react-router';

export function AgentHeader({ agentId }: { agentId: string }) {
  const { agent, isLoading } = useAgent(agentId);

  return (
    <div className="grid gap-5 w-full">
      <Button as={Link} variant="backLink" to={`/agents`}>
        <ArrowLeftIcon />
        Agents
      </Button>

      <MainTitle>
        <AgentIcon /> {agent?.name}
      </MainTitle>

      <InnerNav>
        <Button as={Link} variant="activeNavItem" to={`/agents/${agentId}/chat`}>
          Details
        </Button>
        <Button as={Link} variant="navItem" to={`/agents/${agentId}/traces`}>
          Traces
        </Button>
        <Button as={Link} variant="navItem" to={`/agents/${agentId}/evals`}>
          Evals
        </Button>
        <Button as={Link} variant="navItem" to={`/agents/${agentId}/chat`}>
          Log Drains
        </Button>
        <Button as={Link} variant="navItem" to={`/agents/${agentId}/chat`}>
          Versions
        </Button>
      </InnerNav>
    </div>
  );
}
