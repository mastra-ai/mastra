import { useAgent } from '@/hooks/use-agents';
import { useLocation } from 'react-router';

import { MainTitle, Button, InnerNav, Breadcrumb, Crumb } from '@mastra/playground-ui';
import { AgentIcon } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';

import { Link } from 'react-router';

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
      label: 'Log Drains',
      path: 'log-drains',
    },
    {
      label: 'Versions',
      path: 'versions',
    },
  ];

  const { agent } = useAgent(agentId);
  const currentPath = location.pathname.split('/').pop() || 'chat';

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
    </div>
  );
}
