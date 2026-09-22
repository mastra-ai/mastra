import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { Header } from '@mastra/playground-ui/components/Header';
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
    <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
      <Breadcrumb label="Agent navigation" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
        <Crumb as={Link} to="/agent-builder/agents" data-testid="agent-builder-back-to-list">
          Agent list
        </Crumb>
        <Crumb as="span" isCurrent data-testid="agent-builder-title">
          <AgentBuilderTitle isLoading={isLoading} />
        </Crumb>
      </Breadcrumb>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {rightAside && <div className="mr-1 shrink-0">{rightAside}</div>}
        {primaryAction && <div className="flex shrink-0">{primaryAction}</div>}
        {mobileExtra && <div className="shrink-0 lg:hidden">{mobileExtra}</div>}
        {mode && onModeToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onModeToggle}
            disabled={modeToggleDisabled}
            className="hidden shrink-0 lg:inline-flex"
            data-testid="agent-builder-mode-toggle"
            aria-label={toggleLabel}
            icon={<RefreshCwIcon />}
          >
            {toggleLabel}
          </Button>
        )}
      </div>
    </Header>
  );
};
