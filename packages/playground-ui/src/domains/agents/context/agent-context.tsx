import { createContext, ReactNode, useContext, useState } from 'react';
import { ModelSettings } from '@/types';

import {
  useAgentModelSettingsState,
  defaultModelSettings,
} from '@/domains/agents/hooks/use-agent-model-settings-state';
import { GetAgentResponse } from '@mastra/client-js';

type AgentContextType = {
  modelSettings: ModelSettings;
  chatWithGenerate: boolean;
  isFormDirty: boolean;
  setModelSettings: (modelSettings: ModelSettings) => void;
  resetModelSettings: () => void;
  setChatWithGenerate: (chatWithGenerate: boolean) => void;
  onResetFormDirty: () => void;
};

export const AgentSettingsContext = createContext<AgentContextType>({} as AgentContextType);

export interface AgentSettingsProviderProps {
  initialModelSettings?: Partial<ModelSettings>;
  initialChatWithGenerate?: boolean;
  defaultGenerateOptions?: GetAgentResponse['defaultGenerateOptions'];
  defaultStreamOptions?: GetAgentResponse['defaultStreamOptions'];
  children: ReactNode;
  agentId: string;
}

export function AgentSettingsProvider({
  defaultGenerateOptions,
  defaultStreamOptions,
  children,
  agentId,
  initialModelSettings,
  initialChatWithGenerate,
}: AgentSettingsProviderProps) {
  const initialModelSettingsWithDefaults = initialModelSettings
    ? {
        ...(initialChatWithGenerate ? defaultGenerateOptions : defaultStreamOptions),
        ...initialModelSettings,
      }
    : undefined;

  const [isFormDirty, setIsFormDirty] = useState(false);
  const { modelSettings, setModelSettings, chatWithGenerate, setChatWithGenerate, resetAll } =
    useAgentModelSettingsState({
      agentId,
      initialModelSettings: initialModelSettingsWithDefaults,
      initialChatWithGenerate: initialChatWithGenerate ?? undefined,
    });

  const onChangeModelSettings = (modelSettings: ModelSettings) => {
    setModelSettings(modelSettings);
    setIsFormDirty(true);
  };

  const onChangeChatWithGenerate = (chatWithGenerate: boolean) => {
    setChatWithGenerate(chatWithGenerate);
    setIsFormDirty(true);
  };

  const onReset = () => {
    resetAll();
    setIsFormDirty(false);
  };

  return (
    <AgentSettingsContext.Provider
      value={{
        modelSettings: modelSettings ?? defaultModelSettings,
        setModelSettings: onChangeModelSettings,
        resetModelSettings: onReset,
        chatWithGenerate: chatWithGenerate ?? false,
        setChatWithGenerate: onChangeChatWithGenerate,
        isFormDirty,
        onResetFormDirty: () => setIsFormDirty(false),
      }}
    >
      {children}
    </AgentSettingsContext.Provider>
  );
}

export const useAgentSettings = () => {
  return useContext(AgentSettingsContext);
};
