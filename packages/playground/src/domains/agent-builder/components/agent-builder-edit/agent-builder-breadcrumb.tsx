import { Breadcrumb, Crumb, Skeleton } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { WorkspaceMode } from './workspace-layout';

export interface AgentBuilderBreadcrumbProps {
  className?: string;
  isLoading?: boolean;
  mode?: WorkspaceMode;
}

const MODE_LABELS: Record<WorkspaceMode, string> = {
  build: 'Edit configuration',
  test: 'Chat',
};

export const AgentBuilderBreadcrumb = ({ className, isLoading = false, mode }: AgentBuilderBreadcrumbProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });
  const displayName = name && name.trim() ? name : 'Untitled';

  return (
    <div className={className} data-testid="agent-builder-breadcrumb">
      <Breadcrumb label="Agent builder">
        <Crumb as={Link} to="/agent-builder/agents">
          Agents
        </Crumb>
        <Crumb as="span" isCurrent={!mode}>
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-24 align-middle" data-testid="agent-builder-breadcrumb-skeleton" />
          ) : (
            displayName
          )}
        </Crumb>
        {mode && (
          <Crumb as="span" isCurrent data-testid="agent-builder-mode-crumb">
            {MODE_LABELS[mode]}
          </Crumb>
        )}
      </Breadcrumb>
    </div>
  );
};
