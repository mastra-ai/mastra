import { useState, useEffect } from 'react';
import { TracingSettings } from '../context/tracing-settings-context';

export interface TracingSettingsStateProps {
  entityId: string;
  entityType: 'workflow' | 'agent';
}

export function useTracingSettingsState({ entityId, entityType }: TracingSettingsStateProps) {
  const [settings, setSettingsState] = useState<TracingSettings | undefined>(undefined);

  const LOCAL_STORAGE_KEY = `tracing-options-${entityType}:${entityId}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettingsState(parsed || undefined);
      }
    } catch (e) {
      // ignore
      console.error(e);
    }
  }, [LOCAL_STORAGE_KEY]);

  const setSettings = (settingsValue: TracingSettings) => {
    setSettingsState(prev => ({ ...prev, ...settingsValue }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...settingsValue, entityId, entityType }));
  };

  const resetAll = () => {
    setSettingsState(undefined);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return {
    settings,
    setSettings,
    resetAll,
    entityType,
  };
}
