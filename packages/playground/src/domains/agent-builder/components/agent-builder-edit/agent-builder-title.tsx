import { Skeleton, StatusBadge } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { WorkspaceMode } from './workspace-layout';

export interface AgentBuilderTitleProps {
  className?: string;
  isLoading?: boolean;
  mode?: WorkspaceMode;
  creating?: boolean;
}

const MODE_BADGE: Record<WorkspaceMode, { label: string; variant: 'success' | 'neutral'; testId: string }> = {
  build: { label: 'Edit mode', variant: 'success', testId: 'agent-builder-mode-badge-build' },
  test: { label: 'View mode', variant: 'neutral', testId: 'agent-builder-mode-badge-test' },
};

export const AgentBuilderTitle = ({ className, isLoading = false, mode, creating = false }: AgentBuilderTitleProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });

  if (creating) {
    return (
      <div className={className} data-testid="agent-builder-title">
        <span
          aria-current="page"
          className="block text-ui-md leading-ui-md text-white truncate"
          data-testid="agent-builder-create-title"
        >
          New agent
        </span>
      </div>
    );
  }

  const displayName = name && name.trim() ? name : 'Untitled';
  const badge = mode ? MODE_BADGE[mode] : null;

  return (
    <div className={className} data-testid="agent-builder-title">
      <div className="flex items-center gap-2 min-w-0">
        <span className="block text-ui-md leading-ui-md text-white truncate" data-testid="agent-builder-title-name">
          {isLoading ? (
            <Skeleton className="inline-block h-4 w-24 align-middle" data-testid="agent-builder-title-skeleton" />
          ) : (
            displayName
          )}
        </span>
        {badge && (
          <StatusBadge variant={badge.variant} size="sm" data-testid={badge.testId}>
            {badge.label}
          </StatusBadge>
        )}
      </div>
    </div>
  );
};
