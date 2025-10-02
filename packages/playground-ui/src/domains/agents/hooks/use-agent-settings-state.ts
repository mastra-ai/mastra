import { useState, useEffect } from 'react';
import { AgentSettingsType as AgentSettings, ModelSettings } from '@/types';

export interface AgentSettingsStateProps {
  agentId: string;
}

const defaultSettings: AgentSettings = {
  modelSettings: {
    maxRetries: 2,
    maxSteps: 5,
    temperature: 0.5,
    topP: 1,
    chatWithGenerate: false,
    chatWithGenerateVNext: false,
  },
};

export function useAgentSettingsState({ agentId }: AgentSettingsStateProps) {
  const [settings, setSettingsState] = useState<AgentSettings | undefined>(undefined);

  const LOCAL_STORAGE_KEY = `mastra-agent-store-${agentId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettingsState(parsed ?? undefined);
      }
    } catch (e) {
      // ignore
      console.error(e);
    }

    // Only run on mount or when initialSettings changes
  }, [LOCAL_STORAGE_KEY]);

  const setSettings = (settingsValue: AgentSettings) => {
    setSettingsState(prev => ({ ...prev, ...settingsValue }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...settingsValue, agentId }));
  };

  const resetAll = () => {
    setSettingsState(defaultSettings);

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultSettings));
  };

  return {
    settings,
    setSettings,
    resetAll,
  };
}
