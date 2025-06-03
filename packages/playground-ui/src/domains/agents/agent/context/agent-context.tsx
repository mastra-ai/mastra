import { createContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { ModelSettings } from '../../../../types';
import { useAgentStore } from '@/store/agent-store';
import { GetAgentResponse } from '@mastra/client-js';

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

export function AgentProvider({
  agentId,
  defaultGenerateOptions,
  defaultStreamOptions,
  children,
}: {
  agentId: string;
  defaultGenerateOptions?: GetAgentResponse['defaultGenerateOptions'];
  defaultStreamOptions?: GetAgentResponse['defaultStreamOptions'];
  children: ReactNode;
}) {
  const {
    modelSettings: modelSettingsStore,
    setModelSettings: setModelSettingsStore,
    chatWithGenerate: chatWithGenerateStore,
    setChatWithGenerate: setChatWithGenerateStore,
  } = useAgentStore();

  const chatWithGenerate = chatWithGenerateStore[agentId] || false;
  const setChatWithGenerate = (chatWithGenerate: boolean) => {
    setChatWithGenerateStore({ [agentId]: chatWithGenerate });
  };

  const modelSettings = useMemo(() => {
    if (modelSettingsStore[agentId]) return modelSettingsStore[agentId];
    if (chatWithGenerate) {
      return {
        maxRetries: defaultGenerateOptions?.maxRetries ?? defaultModelSettings.maxRetries,
        maxSteps: defaultGenerateOptions?.maxSteps ?? defaultModelSettings.maxSteps,
        temperature: defaultGenerateOptions?.temperature ?? defaultModelSettings.temperature,
        topP: defaultGenerateOptions?.topP ?? defaultModelSettings.topP,
        ...defaultGenerateOptions,
      };
    } else {
      return {
        maxRetries: defaultStreamOptions?.maxRetries ?? defaultModelSettings.maxRetries,
        maxSteps: defaultStreamOptions?.maxSteps ?? defaultModelSettings.maxSteps,
        temperature: defaultStreamOptions?.temperature ?? defaultModelSettings.temperature,
        topP: defaultStreamOptions?.topP ?? defaultModelSettings.topP,
        ...defaultStreamOptions,
      };
    }
  }, [agentId, defaultGenerateOptions, defaultStreamOptions, chatWithGenerate, modelSettingsStore]);

  const setModelSettings = (modelSettings: ModelSettings) => {
    setModelSettingsStore({ [agentId]: modelSettings });
  };

  const resetModelSettings = () => {
    setModelSettingsStore({ [agentId]: null });
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
