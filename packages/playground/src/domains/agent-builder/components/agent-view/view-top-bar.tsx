import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { RefreshCwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { WorkspaceMode } from '../../layouts/types';
import { AgentBuilderTitle } from '../agent-edit/agent-builder-title';

export interface ViewTopBarProps {
  /**
   * The current workspace mode. When omitted, no mode-toggle is rendered
   * (e.g. for non-owners viewing a public agent).
   */
  mode?: WorkspaceMode;
  /** Called when the user clicks the mode-toggle button to switch to Edit. */
  onModeToggle?: () => void;
  /** Disables the mode-toggle button (e.g. while a stream is running). */
  modeToggleDisabled?: boolean;
  /** Owner-only action slot rendered on desktop (e.g. Publish, Visibility). */
  ownerActions?: ReactNode;
  /** Mobile-only slot rendered to the right (e.g. 3-dot menu). */
  mobileMenu?: ReactNode;
}

export const ViewTopBar = ({
  mode,
  onModeToggle,
  modeToggleDisabled = false,
  ownerActions,
  mobileMenu,
}: ViewTopBarProps) => {
  const toggleLabel = mode === 'test' ? 'Switch to Edit mode' : 'Switch to View mode';

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4 md:px-10"
      data-testid="agent-builder-view-top-bar"
    >
      <Breadcrumb label="Agent navigation" className="min-w-0" listClassName="min-w-0">
        <Crumb as={Link} to="/agent-builder/agents" data-testid="agent-builder-back-to-list">
          Agent list
        </Crumb>
        <Crumb as="span" isCurrent>
          <AgentBuilderTitle isLoading={false} />
        </Crumb>
      </Breadcrumb>
      <div className="flex shrink-0 items-center gap-2 justify-self-end">
        {ownerActions && <div className="hidden shrink-0 items-center gap-2 lg:flex">{ownerActions}</div>}
        {mobileMenu && <div className="shrink-0 lg:hidden">{mobileMenu}</div>}
        {mode && onModeToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onModeToggle}
            disabled={modeToggleDisabled}
            className="hidden shrink-0 lg:inline-flex"
            data-testid="agent-builder-mode-toggle"
            aria-label={toggleLabel}
          >
            <RefreshCwIcon />
            {toggleLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
