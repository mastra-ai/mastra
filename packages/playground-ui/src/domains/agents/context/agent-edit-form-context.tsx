import { createContext, useContext } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { AgentFormValues } from '../components/agent-edit-page/utils/form-validation';

interface AgentEditFormContextValue {
  form: UseFormReturn<AgentFormValues>;
  mode: 'create' | 'edit';
  agentId?: string;
  isSubmitting: boolean;
  isSavingDraft?: boolean;
  handlePublish: () => Promise<void>;
  handleSaveDraft?: (changeMessage?: string) => Promise<void>;
  readOnly?: boolean;
  /** True when editing a code-defined agent (override mode) — limits editable sections */
  isCodeAgentOverride?: boolean;
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

/** Returns the form context or null if no provider is present. */
export function useOptionalAgentEditFormContext() {
  return useContext(AgentEditFormContext);
}
