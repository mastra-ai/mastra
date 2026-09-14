import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import { Button } from '@mastra/playground-ui/components/Button';
import { Header } from '@mastra/playground-ui/components/Header';
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
    <div data-testid="agent-builder-view-top-bar">
      <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
        <Breadcrumb label="Agent navigation" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
          <Crumb
            as={Link}
            to="/agent-builder/agents"
            className="max-w-[18rem]"
            data-testid="agent-builder-back-to-list"
          >
            Agent list
          </Crumb>
          <Crumb as="span" isCurrent className="max-w-[28rem]" data-testid="agent-builder-title">
            <AgentBuilderTitle />
          </Crumb>
        </Breadcrumb>
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
              icon={<RefreshCwIcon />}
            >
              {toggleLabel}
            </Button>
          )}
        </div>
      </Header>
    </div>
  );
};
