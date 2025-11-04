import { useState, useEffect } from 'react';
import { AgentSettingsType as AgentSettings, ModelSettings } from '@/types';

export interface AgentSettingsStateProps {
  agentId: string;
  defaultSettings?: AgentSettings;
}

const defaultSettings: AgentSettings = {
  modelSettings: {
    maxRetries: 2,
    maxSteps: 5,
    temperature: 0.5,
    topP: 1,
    chatWithGenerateLegacy: false,
    chatWithGenerate: false,
  },
};

export function useAgentSettingsState({ agentId, defaultSettings: defaultSettingsProp }: AgentSettingsStateProps) {
  const [settings, setSettingsState] = useState<AgentSettings | undefined>(defaultSettingsProp);

  const LOCAL_STORAGE_KEY = `mastra-agent-store-${agentId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const settings = {
          ...parsed,
          modelSettings: {
            ...(defaultSettingsProp?.modelSettings ?? {}),
            ...(parsed?.modelSettings ?? {}),
          },
        };
        setSettingsState(settings ?? undefined);
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
    const settings = {
      modelSettings: {
        ...(defaultSettingsProp?.modelSettings ?? {}),
        ...defaultSettings.modelSettings,
      },
    };
    setSettingsState(settings);

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  };

  return {
    settings,
    setSettings,
    resetAll,
  };
}
