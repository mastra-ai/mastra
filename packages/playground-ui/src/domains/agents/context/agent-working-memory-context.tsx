import { createContext, useContext, ReactNode } from 'react';
import { useAgentWorkingMemory } from '@/domains/agents/hooks/use-agent-working-memory';

type AgentWorkingMemoryContextType = {
  threadExists: boolean;
  workingMemoryData: string | null;
  workingMemorySource: 'thread' | 'resource' | null;
  isLoading: boolean;
  isUpdating: boolean;
  updateWorkingMemory: (newMemory: string) => Promise<void>;
  refetch: () => Promise<void>;
};

export const WorkingMemoryContext = createContext<AgentWorkingMemoryContextType>({} as AgentWorkingMemoryContextType);

export interface AgentWorkingMemoryProviderProps {
  children: ReactNode;
  agentId: string;
  threadId: string;
  resourceId: string;
}

export function WorkingMemoryProvider({ agentId, threadId, resourceId, children }: AgentWorkingMemoryProviderProps) {
  const value = useAgentWorkingMemory(agentId, threadId, resourceId);
  return <WorkingMemoryContext.Provider value={value}>{children}</WorkingMemoryContext.Provider>;
}

export function useWorkingMemory() {
  const ctx = useContext(WorkingMemoryContext);
  if (!ctx) throw new Error('useWorkingMemory must be used within a WorkingMemoryProvider');
  return ctx;
}
