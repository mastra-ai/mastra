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
  handlePublish: () => Promise<void>;
  readOnly?: boolean;
  basePath: string;
  currentPath: string;
  banner?: ReactNode;
  children: ReactNode;
}

export function AgentCmsFormShell({
  form,
  mode,
  agentId,
  isSubmitting,
  handlePublish,
  readOnly,
  basePath,
  currentPath,
  banner,
  children,
}: AgentCmsFormShellProps) {
  return (
    <AgentEditFormProvider
      form={form}
      mode={mode}
      agentId={agentId}
      isSubmitting={isSubmitting}
      handlePublish={handlePublish}
      readOnly={readOnly}
    >
      <AgentsCmsLayout basePath={basePath} currentPath={currentPath}>
        {banner}
        {children}
      </AgentsCmsLayout>
    </AgentEditFormProvider>
  );
}
