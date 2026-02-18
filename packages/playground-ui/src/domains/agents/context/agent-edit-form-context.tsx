import { createContext, useContext } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { AgentFormValues } from '../components/agent-edit-page/utils/form-validation';

interface AgentEditFormContextValue {
  form: UseFormReturn<AgentFormValues>;
  mode: 'create' | 'edit';
  agentId?: string;
  isSubmitting: boolean;
  handlePublish: () => Promise<void>;
  readOnly?: boolean;
}

const AgentEditFormContext = createContext<AgentEditFormContextValue | null>(null);

export function AgentEditFormProvider({
  children,
  ...value
}: AgentEditFormContextValue & { children: React.ReactNode }) {
  return <AgentEditFormContext.Provider value={value}>{children}</AgentEditFormContext.Provider>;
}

export function useAgentEditFormContext() {
  const ctx = useContext(AgentEditFormContext);
  if (!ctx) {
    throw new Error('useAgentEditFormContext must be used within an AgentEditFormProvider');
  }
  return ctx;
}
