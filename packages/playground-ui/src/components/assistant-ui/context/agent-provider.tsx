import { useMastraClient } from '@/contexts/mastra-client-context';
import { GetAgentResponse } from '@mastra/client-js';
import { createContext, useContext, useEffect, useState } from 'react';

type AgentContextType = {
  isLoading: boolean;
  agentDetails: GetAgentResponse | null;
};
const AgentContext = createContext<AgentContextType>({ isLoading: true, agentDetails: null });

export interface AgentProviderProps {
  agentId?: string;
  children: React.ReactNode;
}

export function AgentProvider({ agentId, children }: AgentProviderProps) {
  const [agentDetails, setAgentDetails] = useState<AgentContextType>({ isLoading: true, agentDetails: null });
  const client = useMastraClient();

  useEffect(() => {
    if (!agentId) return;
    client
      .getAgent(agentId)
      .details()
      .then(agentDetails => setAgentDetails({ isLoading: false, agentDetails }));
  }, [agentId]);

  return <AgentContext.Provider value={agentDetails}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  return useContext(AgentContext);
}
