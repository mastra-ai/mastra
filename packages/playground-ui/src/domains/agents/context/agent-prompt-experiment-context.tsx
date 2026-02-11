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

    // Only use stored prompt if it differs from code-defined prompt (intentional edit).
    // If stored prompt equals the old code-defined prompt, the code has changed
    // underneath us and we should use the new code-defined value instead.
    if (storedPrompt && storedPrompt !== initialPromptText) {
      setPrompt(storedPrompt);
    } else {
      localStorage.removeItem(`agent-prompt-experiment-${agentId}`);
      setPrompt(initialPromptText);
    }
  }, [agentId, initialPromptText]);

  // Only persist to localStorage when the user has actually edited the prompt
  // away from the code-defined value. If the prompt matches the code, clear
  // localStorage so the code-defined value always wins on next load.
  useEffect(() => {
    if (!prompt) return;

    if (prompt !== initialPromptText) {
      localStorage.setItem(`agent-prompt-experiment-${agentId}`, prompt);
    } else {
      localStorage.removeItem(`agent-prompt-experiment-${agentId}`);
    }
  }, [prompt, agentId, initialPromptText]);

  const isDirty = prompt !== initialPromptText;

  const resetPrompt = () => {
    setPrompt(initialPromptText);
    localStorage.removeItem(`agent-prompt-experiment-${agentId}`);
  };

  return (
    <AgentPromptExperimentContext.Provider value={{ isDirty, prompt, setPrompt, resetPrompt }}>
      {children}
    </AgentPromptExperimentContext.Provider>
  );
};
