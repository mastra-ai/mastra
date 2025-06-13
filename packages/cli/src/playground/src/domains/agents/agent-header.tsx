import { useAgent } from '@/hooks/use-agents';
import { useLocation } from 'react-router';

import { MainTitle, Button, InnerNav, MainHeader } from '@mastra/playground-ui';
import { AgentIcon } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';

import { Link } from 'react-router';
import { cn } from '@/lib/utils';

export function AgentHeader({ agentId }: { agentId: string }) {
  const location = useLocation();

  type NavButton = {
    label: string;
    path: string;
  };

  const navButtons: NavButton[] = [
    {
      label: 'Details',
      path: 'chat',
    },
    {
      label: 'Traces',
      path: 'traces',
    },
    {
      label: 'Evals',
      path: 'evals',
    },
    {
      label: 'Versions',
      path: 'versions',
    },
    {
      label: 'Log Drains',
      path: 'log-drains',
    },
  ];

  const { agent } = useAgent(agentId);
  const currentPath = location.pathname.split('/').pop() || 'chat';
  const twoColumns = ['traces', 'evals'].includes(currentPath);

  return (
    <MainHeader variant={twoColumns ? 'twoColsForAgent' : 'oneColForAgent'}>
      <Button as={Link} variant="backLink" to={`/agents`}>
        <ArrowLeftIcon />
        Agents
      </Button>

      <MainTitle>
        <AgentIcon /> {agent?.name}
      </MainTitle>

      <InnerNav>
        {navButtons.map(button => (
          <Button
            key={button.path}
            as={Link}
            variant={button.path === currentPath ? 'activeNavItem' : 'navItem'}
            to={`/agents/${agentId}/${button.path}`}
          >
            {button.label}
          </Button>
        ))}
      </InnerNav>
    </MainHeader>
  );
}
