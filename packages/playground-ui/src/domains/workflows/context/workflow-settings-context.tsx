import { TracingOptions } from '@mastra/core/observability';
import { createContext, ReactNode, useContext } from 'react';
import { useWorkflowSettingsState } from '../hooks/use-workflow-settings-state';

export type WorkflowSettings = {
  tracingOptions?: TracingOptions;
};

export type WorkflowSettingsContextType = {
  setSettings: (settings: WorkflowSettings) => void;
  resetAll: () => void;
  settings?: WorkflowSettings;
};

export const WorkflowSettingsContext = createContext<WorkflowSettingsContextType>({
  setSettings: () => {},
  resetAll: () => {},
  settings: undefined,
});

export interface WorkflowSettingsProviderProps {
  children: ReactNode;
  workflowId: string;
}

export const WorkflowSettingsProvider = ({ children, workflowId }: WorkflowSettingsProviderProps) => {
  const state = useWorkflowSettingsState({ workflowId });

  return <WorkflowSettingsContext.Provider value={state}>{children}</WorkflowSettingsContext.Provider>;
};

export const useWorkflowSettings = () => {
  return useContext(WorkflowSettingsContext);
};
