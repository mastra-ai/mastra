/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { AgentFormValues } from '../components/agent-edit-page/utils/form-validation';

export type AgentEditorConfig = false | { instructions?: boolean; tools?: boolean | { description?: boolean } };

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
  /** True when the editor is running in `source: 'code'` AND the agent is code-defined — saves persist to filesystem. */
  isCodeSourceAgent?: boolean;
  /** Field ownership rules from the code-defined agent config. */
  editorConfig?: AgentEditorConfig;
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
