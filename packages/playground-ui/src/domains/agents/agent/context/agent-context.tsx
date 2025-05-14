import { createContext, useState, ReactNode, useEffect } from 'react';
import { ModelSettings } from '../../../../types';
import { useAgentStore } from '@/store/agent-store';

type AgentContextType = {
  modelSettings: ModelSettings;
  chatWithGenerate: boolean;
  setModelSettings: (modelSettings: ModelSettings) => void;
  resetModelSettings: () => void;
  setChatWithGenerate: (chatWithGenerate: boolean) => void;
};

const defaultModelSettings: ModelSettings = {
  maxRetries: 2,
  maxSteps: 5,
  temperature: 0.5,
  topP: 1,
};

export const AgentContext = createContext<AgentContextType>({} as AgentContextType);

export function AgentProvider({ agentId, children }: { agentId: string; children: ReactNode }) {
  const {
    modelSettings: modelSettingsStore,
    setModelSettings: setModelSettingsStore,
    chatWithGenerate: chatWithGenerateStore,
    setChatWithGenerate: setChatWithGenerateStore,
  } = useAgentStore();

  const modelSettings = modelSettingsStore[agentId] || defaultModelSettings;

  const setModelSettings = (modelSettings: ModelSettings) => {
    setModelSettingsStore({ [agentId]: modelSettings });
  };

  const resetModelSettings = () => {
    setModelSettings(defaultModelSettings);
  };

  const chatWithGenerate = chatWithGenerateStore[agentId] || false;
  const setChatWithGenerate = (chatWithGenerate: boolean) => {
    setChatWithGenerateStore({ [agentId]: chatWithGenerate });
  };

  return (
    <AgentContext.Provider
      value={{
        modelSettings,
        setModelSettings,
        resetModelSettings,
        chatWithGenerate,
        setChatWithGenerate,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}
