/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { AgentFormValues } from '../components/agent-edit-page/utils/form-validation';

export type AgentEditorConfig = false | { instructions?: boolean; tools?: boolean | { description?: boolean } };

/**
 * A code-defined agent locks its instructions when the editor config either disables the whole
 * editor (`editor: false`) or explicitly disowns instructions (`editor.instructions === false`).
 * Mirror this anywhere instructions are rendered so the UI matches what the server persists on save.
 */
export function isInstructionsLocked(
  isCodeAgentOverride: boolean | undefined,
  editorConfig: AgentEditorConfig | undefined,
): boolean {
  return !!isCodeAgentOverride && (editorConfig === false || editorConfig?.instructions === false);
}

/** Mirror of {@link isInstructionsLocked} for tools (`editor: false` or `editor.tools === false`). */
export function isToolsLocked(
  isCodeAgentOverride: boolean | undefined,
  editorConfig: AgentEditorConfig | undefined,
): boolean {
  return !!isCodeAgentOverride && (editorConfig === false || editorConfig?.tools === false);
}

/**
 * A code-agent override exposes only Instructions and Tools as editable surfaces (Variables are
 * read-only code-defined info). When both are locked, nothing is editable, so the editor is
 * effectively read-only even though `editor` is not the global `false` kill-switch.
 */
export function isEditorEffectivelyReadOnly(
  isCodeAgentOverride: boolean | undefined,
  editorConfig: AgentEditorConfig | undefined,
): boolean {
  return isInstructionsLocked(isCodeAgentOverride, editorConfig) && isToolsLocked(isCodeAgentOverride, editorConfig);
}

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
