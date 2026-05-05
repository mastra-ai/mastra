import { IconButton, Skeleton, StatusBadge } from '@mastra/playground-ui';
import { RefreshCwIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { WorkspaceMode } from './workspace-layout';

export interface AgentBuilderTitleProps {
  className?: string;
  isLoading?: boolean;
  mode?: WorkspaceMode;
  /** Called when the user clicks the mode-toggle button next to the badge. */
  onModeToggle?: () => void;
  /** Disables the mode-toggle button (e.g. while a stream is running). */
  disabled?: boolean;
}

const MODE_BADGE: Record<WorkspaceMode, { label: string; variant: 'success' | 'neutral'; testId: string }> = {
  build: { label: 'Edit mode', variant: 'success', testId: 'agent-builder-mode-badge-build' },
  test: { label: 'View mode', variant: 'neutral', testId: 'agent-builder-mode-badge-test' },
};

export const AgentBuilderTitle = ({
  className,
  isLoading = false,
  mode,
  onModeToggle,
  disabled = false,
}: AgentBuilderTitleProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });

  const displayName = name && name.trim() ? name : 'Untitled';
  const badge = mode ? MODE_BADGE[mode] : null;
  const toggleLabel = mode === 'test' ? 'Switch to Edit mode' : 'Switch to View mode';

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
          <StatusBadge
            variant={badge.variant}
            size="lg"
            className="hidden sm:inline-flex h-form-sm"
            data-testid={badge.testId}
          >
            {badge.label}
          </StatusBadge>
        )}
        {mode && onModeToggle && (
          <IconButton
            size="sm"
            variant="default"
            tooltip={toggleLabel}
            onClick={onModeToggle}
            disabled={disabled}
            className="hidden lg:inline-flex rounded-full"
            data-testid="agent-builder-mode-toggle"
          >
            <RefreshCwIcon />
          </IconButton>
        )}
      </div>
    </div>
  );
};
