import { Chat } from '@shared/components/Chat';
import { Layout } from '@shared/components/layout';
import { Header } from '@shared/components/ui/header';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useAgent } from '@shared/hooks/use-agents';
import { useEffect, useState } from 'react';

import { AgentInformation } from './components/agent-information';

function App() {
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
      <Layout>
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
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={`Chat with ${agent?.name}`} />
        <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
          <Chat agentId={agentId} agentName={agent?.name} />
          <div className="flex flex-col">
            <AgentInformation agentId={agentId} />
          </div>
        </main>
      </div>
    </Layout>
  );
}

export default App;
