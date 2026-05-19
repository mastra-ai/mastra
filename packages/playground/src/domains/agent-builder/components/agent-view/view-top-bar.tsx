import { Button } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { WorkspaceMode } from '../../layouts/types';
import { AgentBuilderTitle } from '../agent-edit/agent-builder-title';

export interface ViewTopBarProps {
  /**
   * The current workspace mode. When omitted, no mode badge or mode-toggle is
   * rendered (e.g. for non-owners viewing a public agent).
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
  const navigate = useNavigate();

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4 md:px-10"
      data-testid="agent-builder-view-top-bar"
    >
      <div className="justify-self-start">
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Agents list"
          onClick={() => navigate('/agent-builder/agents', { viewTransition: true })}
        >
          <ArrowLeftIcon />
        </Button>
      </div>
      <AgentBuilderTitle
        className="min-w-0 justify-self-start"
        isLoading={false}
        mode={mode}
        onModeToggle={onModeToggle}
        disabled={modeToggleDisabled}
      />
      <div className="justify-self-end flex items-center gap-2 shrink-0">
        {ownerActions && <div className="shrink-0 hidden lg:flex items-center gap-2">{ownerActions}</div>}
        {mobileMenu && <div className="shrink-0 lg:hidden">{mobileMenu}</div>}
      </div>
    </div>
  );
};
