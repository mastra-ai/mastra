import { useParams } from 'react-router';

import { Chat } from '@/components/Chat';
import Breadcrumb from '@/components/ui/breadcrumbs';
import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { AgentInformation } from '@/domains/agents/agent-information';
import { useAgent } from '@/hooks/use-agents';

function Agent() {
  const { agentId } = useParams();
  const { agent, isLoading: isAgentLoading } = useAgent(agentId!);

  if (isAgentLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
        <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
          <div className="flex flex-col">
            <AgentInformation agentId={agentId!} />
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
      isCurrent: true,
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={<Breadcrumb items={breadcrumbItems} />} />
      <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
        <Chat agentId={agentId!} agentName={agent?.name} />
        <div className="flex flex-col">
          <AgentInformation agentId={agentId!} />
        </div>
      </main>
    </div>
  );
}

export default Agent;
