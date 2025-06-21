import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { AgentChat } from './domains/agents/agent/agent-chat';
import { MastraClientProvider } from './contexts/mastra-client-context'; // adjust this path if incorrect

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MastraClientProvider>
      <AgentChat agentId="catOne" agentName="catOne" />
    </MastraClientProvider>
  </StrictMode>,
);
