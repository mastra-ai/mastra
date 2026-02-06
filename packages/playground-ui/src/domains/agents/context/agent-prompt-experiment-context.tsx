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
    let storedPrompt = localStorage.getItem(`agent-prompt-experiment-${agentId}`);

    const lastPromtOriginal = getPrompt('original');

    //reflect the prompt from code change , overrides browser saved data
    if (lastPromtOriginal != initialPromptText) {
      storePrompt('original', initialPromptText);
      storePrompt('local', initialPromptText);
      storedPrompt = initialPromptText;
    }

    setPrompt(storedPrompt ?? initialPromptText);
  }, [agentId, initialPromptText]);

  const storePrompt = (type: 'original' | 'local', prompt: string) => {
    return localStorage.setItem(`agent-prompt-${type === 'original' ? 'original-' : ''}experiment-${agentId}`, prompt);
  };
  const getPrompt = (type: 'original' | 'local') => {
    return localStorage.getItem(`agent-prompt-${type === 'original' ? 'original-' : ''}experiment-${agentId}`);
  };

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
