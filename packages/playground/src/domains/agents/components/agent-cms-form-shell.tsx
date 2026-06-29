import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { AgentEditFormProvider } from '../context/agent-edit-form-context';
import type { AgentEditorConfig } from '../context/agent-edit-form-context';
import { AgentsCmsLayout } from './agent-cms-layout/agent-cms-layout';
import type { AgentFormValues } from './agent-edit-page/utils/form-validation';

export interface AgentCmsFormShellProps {
  form: UseFormReturn<AgentFormValues>;
  mode: 'create' | 'edit';
  agentId?: string;
  isSubmitting: boolean;
  isSavingDraft?: boolean;
  handlePublish: () => Promise<void>;
  handleSaveDraft?: (changeMessage?: string) => Promise<void>;
  readOnly?: boolean;
  isCodeAgentOverride?: boolean;
  isCodeSourceAgent?: boolean;
  editorConfig?: AgentEditorConfig;
  basePath: string;
  currentPath: string;
  banner?: ReactNode;
  children: ReactNode;
  versionId?: string;
  rightPanel?: ReactNode;
}

export function AgentCmsFormShell({
  form,
  mode,
  agentId,
  isSubmitting,
  isSavingDraft,
  handlePublish,
  handleSaveDraft,
  readOnly,
  isCodeAgentOverride,
  isCodeSourceAgent,
  editorConfig,
  basePath,
  currentPath,
  banner,
  children,
  versionId,
  rightPanel,
}: AgentCmsFormShellProps) {
  return (
    <AgentEditFormProvider
      form={form}
      mode={mode}
      agentId={agentId}
      isSubmitting={isSubmitting}
      isSavingDraft={isSavingDraft}
      handlePublish={handlePublish}
      handleSaveDraft={handleSaveDraft}
      readOnly={readOnly}
      isCodeAgentOverride={isCodeAgentOverride}
      isCodeSourceAgent={isCodeSourceAgent}
      editorConfig={editorConfig}
    >
      <AgentsCmsLayout basePath={basePath} currentPath={currentPath} versionId={versionId} rightPanel={rightPanel}>
        {banner}
        {children}
      </AgentsCmsLayout>
    </AgentEditFormProvider>
  );
}
