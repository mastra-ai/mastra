import { useEffect, useState } from 'react';

import { Chat } from '@/components/Chat';
import { Layout } from '@/components/layout';
import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { AgentInformation } from '@/domains/agents/agent-information';
import { useAgent } from '@/hooks/use-agents';

function Agent() {
  const [agentId, setAgentId] = useState<string>('');
  const { agent, isLoading: isAgentLoading } = useAgent(agentId);

  useEffect(() => {
    // Extract agentId from URL path /agent/:agentId
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[2];
    if (id) {
      setAgentId(id);
    }
  }, []);

  if (isAgentLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
        <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
          <div className="p-4">
            <Skeleton className="h-[600px]" />
          </div>
          <div className="flex flex-col">
            <AgentInformation agentId={agentId} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title={`Chat with ${agent?.name}`} />
      <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
        <Chat agentId={agentId} agentName={agent?.name} />
        <div className="flex flex-col">
          <AgentInformation agentId={agentId} />
        </div>
      </main>
    </div>
  );
}

export default Agent;
