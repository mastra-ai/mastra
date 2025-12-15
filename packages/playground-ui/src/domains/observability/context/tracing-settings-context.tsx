import { TracingOptions } from '@mastra/core/observability';
import { createContext, ReactNode, useContext } from 'react';
import { useTracingSettingsState } from '../hooks/use-tracing-settings-state';

export type TracingSettings = {
  tracingOptions?: TracingOptions;
};

export type TracingSettingsContextType = {
  setSettings: (settings: TracingSettings) => void;
  resetAll: () => void;
  settings?: TracingSettings;
};

export const TracingSettingsContext = createContext<TracingSettingsContextType>({
  setSettings: () => {},
  resetAll: () => {},
  settings: undefined,
});

export interface TracingSettingsProviderProps {
  children: ReactNode;
  entityId: string;
  entityType: 'workflow' | 'agent';
}

export const TracingSettingsProvider = ({ children, entityId, entityType }: TracingSettingsProviderProps) => {
  const state = useTracingSettingsState({ entityId, entityType });

  return <TracingSettingsContext.Provider value={state}>{children}</TracingSettingsContext.Provider>;
};

export const useTracingSettings = () => {
  return useContext(TracingSettingsContext);
};
