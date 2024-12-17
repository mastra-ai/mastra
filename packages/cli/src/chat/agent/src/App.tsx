import { Chat } from '@shared/components/Chat';
import { Layout } from '@shared/components/layout';
import { Header } from '@shared/components/ui/header';
import { useEffect, useState } from 'react';

import { AgentInformation } from './components/agent-information';

function App() {
  const [agentId, setAgentId] = useState<string>('');

  useEffect(() => {
    // Extract agentId from URL path /agent/:agentId
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[2];
    if (id) {
      setAgentId(id);
    }
  }, []);

  return (
    <Layout>
      <div className="flex flex-col h-full overflow-hidden">
        <Header title={`Chat with ${agentId}`} />
        <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
          <Chat agentId={agentId} />
          <div className="flex flex-col">
            <AgentInformation agentId={agentId} />
          </div>
        </main>
      </div>
    </Layout>
  );
}

export default App;
