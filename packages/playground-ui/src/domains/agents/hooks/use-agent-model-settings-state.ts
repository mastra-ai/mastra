import { useState, useEffect } from 'react';
import { ModelSettings } from '@/types';

export interface AgentModelSettingsStateProps {
  initialModelSettings?: ModelSettings;
  initialChatWithGenerate?: boolean;
  agentId: string;
}

export const defaultModelSettings: ModelSettings = {
  maxRetries: 2,
  maxSteps: 5,
  temperature: 0.5,
  topP: 1,
};

export function useAgentModelSettingsState({ agentId }: AgentModelSettingsStateProps) {
  const [modelSettings, setModelSettingsState] = useState<ModelSettings | undefined>(undefined);
  const [chatWithGenerate, setChatWithGenerateState] = useState<boolean>(false);

  const LOCAL_STORAGE_KEY = `mastra-agent-store-${agentId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setModelSettingsState(parsed.modelSettings ?? undefined);
        setChatWithGenerateState(parsed.chatWithGenerate ?? false);
      }
    } catch (e) {
      // ignore
      console.error(e);
    }

    // Only run on mount or when initialSettings changes
  }, [LOCAL_STORAGE_KEY]);

  useEffect(() => {
    if (modelSettings) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ modelSettings, chatWithGenerate, agentId }));
    }
  }, [modelSettings, chatWithGenerate, LOCAL_STORAGE_KEY]);

  const setModelSettings = (modelSettingsValue: ModelSettings) =>
    setModelSettingsState(prev => ({ ...prev, ...modelSettingsValue }));

  const setChatWithGenerate = (chatWithGenerateValue: boolean) => setChatWithGenerateState(chatWithGenerateValue);

  const resetAll = () => {
    setModelSettingsState(defaultModelSettings);
    setChatWithGenerate(false);
  };

  return {
    modelSettings,
    chatWithGenerate,
    setModelSettings,
    setChatWithGenerate,
    resetAll,
  };
}
