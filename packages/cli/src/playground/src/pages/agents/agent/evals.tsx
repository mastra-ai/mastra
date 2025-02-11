import { useParams } from 'react-router';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { AgentEvals } from '@/domains/agents/agent-evals';
import { useAgent } from '@/hooks/use-agents';

function AgentEvalsPage() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  if (isAgentLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
        <main className="flex-1">
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
        </main>
      </div>
    );
  }

  const breadcrumbItems = [
    {
      label: 'Agents',
      href: '/agents',
    },
    {
      label: agent?.name,
      href: `/agents/${agentId}`,
    },
    { label: 'Evals', href: `/agents/${agentId}/evals`, isCurrent: true },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={<Breadcrumb items={breadcrumbItems} />} />
      <main className="flex-1">
        <AgentEvals agentId={agentId!} />
      </main>
    </div>
  );
}

export default AgentEvalsPage;
