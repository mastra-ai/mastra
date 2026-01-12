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
      const parsed = stored ? JSON.parse(stored) : {};

      // Merge order: fallback defaults < localStorage < agent code defaults
      // Agent code defaults win so developers can iterate on their defaults
      const mergedSettings = {
        ...parsed,
        modelSettings: {
          ...defaultSettings.modelSettings,
          ...(parsed?.modelSettings ?? {}),
          ...(defaultSettingsProp?.modelSettings ?? {}), // Code defaults win
        },
      };
      setSettingsState(mergedSettings);
    } catch (e) {
      // ignore
    }
  }, [LOCAL_STORAGE_KEY, defaultSettingsProp]);

  const setSettings = (settingsValue: AgentSettings) => {
    setSettingsState(prev => ({ ...prev, ...settingsValue }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...settingsValue, agentId }));
  };

  const resetAll = () => {
    // Reset to agent defaults (if any), with fallback defaults as base
    const resetSettings = {
      modelSettings: {
        ...defaultSettings.modelSettings,
        ...(defaultSettingsProp?.modelSettings ?? {}),
      },
    };
    setSettingsState(resetSettings);

    // Clear localStorage so code defaults take precedence on next load
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return {
    settings,
    setSettings,
    resetAll,
  };
}
