import { Chat } from '@shared/components/Chat';
import { Layout } from '@shared/components/layout';
import { Header } from '@shared/components/ui/header';
import { useEffect, useState } from 'react';

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
      <div className="flex flex-col h-full overflow-hidden bg-background">
        <Header title={`Chat with ${agentId}`} />
        <main className="flex-1 relative">
          <Chat agentId={agentId} />
        </main>
      </div>
    </Layout>
  );
}

export default App;
