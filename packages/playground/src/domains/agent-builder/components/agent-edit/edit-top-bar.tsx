import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { RefreshCwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { WorkspaceMode } from '../../layouts/types';
import { AgentBuilderTitle } from './agent-builder-title';

export interface EditTopBarProps {
  isLoading: boolean;
  /**
   * The current workspace mode. When omitted, no mode-toggle is rendered
   * (e.g. for non-owners viewing a public agent).
   */
  mode?: WorkspaceMode;
  /** Called when the user clicks the mode-toggle button to switch between Edit and View. */
  onModeToggle?: () => void;
  /** Disables the mode-toggle button (e.g. while a stream is running). */
  modeToggleDisabled?: boolean;
  /** Very-subtle slot rendered first (leftmost) in the right action cluster (e.g. autosave status). */
  rightAside?: ReactNode;
  primaryAction?: ReactNode;
  /** Optional slot rendered AFTER primaryAction (e.g. mobile-only 3-dot menu). */
  mobileExtra?: ReactNode;
}

export const EditTopBar = ({
  isLoading,
  mode,
  onModeToggle,
  modeToggleDisabled = false,
  rightAside,
  primaryAction,
  mobileExtra,
}: EditTopBarProps) => {
  const toggleLabel = mode === 'test' ? 'Switch to Edit mode' : 'Switch to View mode';

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4 md:px-10">
      <Breadcrumb label="Agent navigation" className="min-w-0" listClassName="min-w-0">
        <Crumb as={Link} to="/agent-builder/agents" data-testid="agent-builder-back-to-list">
          Agent list
        </Crumb>
        <Crumb as="span" isCurrent>
          <AgentBuilderTitle isLoading={isLoading} />
        </Crumb>
      </Breadcrumb>
      <div className="justify-self-end flex items-center gap-2 shrink-0">
        {rightAside && <div className="shrink-0 mr-1">{rightAside}</div>}
        {primaryAction && <div className="shrink-0 flex">{primaryAction}</div>}
        {mobileExtra && <div className="shrink-0 lg:hidden">{mobileExtra}</div>}
        {mode && onModeToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onModeToggle}
            disabled={modeToggleDisabled}
            className="hidden lg:inline-flex shrink-0"
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
