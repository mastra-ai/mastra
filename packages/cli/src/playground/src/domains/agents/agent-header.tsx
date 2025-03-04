import { useMatch, useNavigate } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/ui/header';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  const isEvalsPage = useMatch(`/agents/${agentId}/evals`);
  const isChatPage = useMatch(`/agents/${agentId}/chat`) || useMatch(`/agents/${agentId}/chat/*`);
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
        variant={isChatPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/agents/${agentId}/chat`)}
        className="rounded-[0.125rem] px-2"
      >
        Chat
      </Button>
      <Button
        variant={isTracesPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/agents/${agentId}/traces`)}
        className="rounded-[0.125rem] px-2"
      >
        Traces
      </Button>
      <Button
        variant={isEvalsPage ? 'secondary' : 'outline'}
        size="slim"
        onClick={() => navigate(`/agents/${agentId}/evals`)}
        className="rounded-[0.125rem] px-2"
      >
        Evals
      </Button>
    </Header>
  );
}
