import { useMatch, useNavigate } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  const isEvalsPage = useMatch(`/agents/${agentId}/evals`);
  const isChatPage = useMatch(`/agents/${agentId}/chat`);
  const isTracesPage = useMatch(`/agents/${agentId}/traces`);
  const navigate = useNavigate();

  const breadcrumbItems = [
    {
      label: 'Agents',
      href: '/agents',
    },
    {
      label: agentName,
      href: `/agents/${agentId}`,
      isCurrent: true,
    },
  ];
  return (
    <Header title={<Breadcrumb items={breadcrumbItems} />}>
      <Button
        variant={isChatPage ? 'primary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/agents/${agentId}/chat`)}
      >
        Chat
      </Button>
      <Button
        variant={isTracesPage ? 'primary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/agents/${agentId}/traces`)}
      >
        Traces
      </Button>
      <Button
        variant={isEvalsPage ? 'primary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/agents/${agentId}/evals`)}
      >
        Evals
      </Button>
    </Header>
  );
}
