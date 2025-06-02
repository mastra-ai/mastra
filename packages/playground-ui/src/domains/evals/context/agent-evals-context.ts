import { createContext, useContext } from 'react';

type AgentEvalsContextType = {
  onRefresh: () => void;
};

export const AgentEvalsContext = createContext<AgentEvalsContextType>({ onRefresh: () => {} });

export const useAgentEvalsContext = () => {
  return useContext(AgentEvalsContext);
};
