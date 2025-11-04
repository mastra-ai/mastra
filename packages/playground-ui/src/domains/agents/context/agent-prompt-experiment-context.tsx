import { SystemMessage } from '@mastra/core/llm';
import { createContext, useContext, useEffect, useState } from 'react';
import { extractPrompt } from '../utils/extractPrompt';

type AgentPromptExperimentContextType = {
  isDirty: boolean;
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  resetPrompt: () => void;
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

export const AgentPromptExperimentProvider = ({
  children,
  initialPrompt,
  agentId,
}: AgentPromptExperimentProviderProps) => {
  const [initialPromptText] = useState(() => setupPrompt(initialPrompt));
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const storedPrompt = localStorage.getItem(`agent-prompt-experiment-${agentId}`);

    setPrompt(storedPrompt ?? initialPromptText);
  }, [agentId, initialPromptText]);

  useEffect(() => {
    if (!prompt) return;

    localStorage.setItem(`agent-prompt-experiment-${agentId}`, prompt);
  }, [prompt, agentId]);

  const isDirty = prompt !== initialPromptText;

  const resetPrompt = () => {
    setPrompt(initialPromptText);
    localStorage.setItem(`agent-prompt-experiment-${agentId}`, initialPromptText);
  };

  return (
    <AgentPromptExperimentContext.Provider value={{ isDirty, prompt, setPrompt, resetPrompt }}>
      {children}
    </AgentPromptExperimentContext.Provider>
  );
};
