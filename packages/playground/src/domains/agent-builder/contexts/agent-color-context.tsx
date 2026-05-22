/* eslint-disable react-refresh/only-export-components */
import { stringToColor } from '@mastra/playground-ui';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export type AgentColors = {
  background: string;
  foreground: string;
  tint: string;
} | null;

export const AgentColorContext = createContext<AgentColors>(null);

interface AgentColorProviderProps {
  agentId: string;
  children: ReactNode;
}

export const AgentColorProvider = ({ agentId, children }: AgentColorProviderProps) => {
  const value = useMemo<AgentColors>(() => {
    if (!agentId) return null;

    return {
      background: stringToColor(agentId),
      foreground: stringToColor(agentId, 20),
      tint: stringToColor(agentId, 50),
    };
  }, [agentId]);

  return <AgentColorContext.Provider value={value}>{children}</AgentColorContext.Provider>;
};

export const useAgentColor = (): AgentColors => useContext(AgentColorContext);
