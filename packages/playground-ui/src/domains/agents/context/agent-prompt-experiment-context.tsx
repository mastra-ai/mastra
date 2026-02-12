import { SystemMessage } from '@mastra/core/llm';
import { createContext, useContext, useState } from 'react';
import { extractPrompt } from '../utils/extractPrompt';

type AgentPromptExperimentContextType = {
  prompt: string;
};

const AgentPromptExperimentContext = createContext<AgentPromptExperimentContextType>(
  {} as AgentPromptExperimentContextType,
);

export const useAgentPromptExperiment = () => useContext(AgentPromptExperimentContext);

export interface AgentPromptExperimentProviderProps {
  children: React.ReactNode;
  initialPrompt: SystemMessage;
  agentId: string;
}

const setupPrompt = (initialPrompt: SystemMessage) => {
  return extractPrompt(initialPrompt)
    .split('\n')
    .map(line => line.trim())
    .join('\n');
};

export const AgentPromptExperimentProvider = ({ children, initialPrompt }: AgentPromptExperimentProviderProps) => {
  const [prompt] = useState(() => setupPrompt(initialPrompt));

  return <AgentPromptExperimentContext.Provider value={{ prompt }}>{children}</AgentPromptExperimentContext.Provider>;
};
