import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { AgentFormValues } from './agent-edit-page/utils/form-validation';
import { AgentEditFormProvider } from '../context/agent-edit-form-context';
import { AgentsCmsLayout } from './agent-cms-layout/agent-cms-layout';

export interface AgentCmsFormShellProps {
  form: UseFormReturn<AgentFormValues>;
  mode: 'create' | 'edit';
  agentId?: string;
  isSubmitting: boolean;
  isSavingDraft?: boolean;
  handlePublish: () => Promise<void>;
  handleSaveDraft?: () => Promise<void>;
  readOnly?: boolean;
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
    >
      <AgentsCmsLayout basePath={basePath} currentPath={currentPath} versionId={versionId} rightPanel={rightPanel}>
        {banner}
        {children}
      </AgentsCmsLayout>
    </AgentEditFormProvider>
  );
}
