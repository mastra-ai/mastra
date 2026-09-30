/* eslint-disable react-refresh/only-export-components */
import { hueColors, hueForName } from '@mastra/playground-ui/utils/colors';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export type AgentColors = {
  background: string;
  foreground: string;
  tint: string;
};

const AgentColorContext = createContext<AgentColors | null>(null);

interface AgentColorProviderProps {
  agentId: string;
  children: ReactNode;
}

export const AgentColorProvider = ({ agentId, children }: AgentColorProviderProps) => {
  const value = useMemo<AgentColors>(() => {
    if (!agentId) {
      throw new Error('AgentColorProvider requires a non-empty agentId');
    }

    return hueColors(hueForName(agentId));
  }, [agentId]);

  return <AgentColorContext.Provider value={value}>{children}</AgentColorContext.Provider>;
};

export const useAgentColor = (): AgentColors => {
  const value = useContext(AgentColorContext);
  if (value === null) {
    throw new Error('useAgentColor must be used inside an AgentColorProvider');
  }
  return value;
};
