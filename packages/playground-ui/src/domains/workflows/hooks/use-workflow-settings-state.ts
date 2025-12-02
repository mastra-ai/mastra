import { useState, useEffect } from 'react';
import { WorkflowSettings } from '../context/workflow-settings-context';

export interface WorkflowSettingsStateProps {
  workflowId: string;
}

export function useWorkflowSettingsState({ workflowId }: WorkflowSettingsStateProps) {
  const [settings, setSettingsState] = useState<WorkflowSettings | undefined>(undefined);

  const LOCAL_STORAGE_KEY = `mastra-workflow-store-${workflowId}`;

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

    // Only run on mount or when initialSettings changes
  }, [LOCAL_STORAGE_KEY]);

  const setSettings = (settingsValue: WorkflowSettings) => {
    setSettingsState(prev => ({ ...prev, ...settingsValue }));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ...settingsValue, workflowId }));
  };

  const resetAll = () => {
    setSettingsState(undefined);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  };

  return {
    settings,
    setSettings,
    resetAll,
  };
}
