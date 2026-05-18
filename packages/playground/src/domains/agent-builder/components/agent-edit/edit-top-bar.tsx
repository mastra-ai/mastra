import { Button } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { WorkspaceMode } from '../../layouts/workspace-layout';
import { AgentBuilderTitle } from './agent-builder-title';

export interface EditTopBarProps {
  isLoading: boolean;
  /**
   * The current workspace mode. When omitted, no mode badge or mode-toggle is
   * rendered (e.g. for non-owners viewing a public agent).
   */
  mode?: WorkspaceMode;
  /** Called when the user clicks the mode badge to switch between Edit and View. */
  onModeToggle?: () => void;
  /** Disables the mode-toggle button (e.g. while a stream is running). */
  modeToggleDisabled?: boolean;
  /** Very-subtle slot rendered first (leftmost) in the right action cluster (e.g. autosave status). */
  rightAside?: ReactNode;
  modeAction?: ReactNode;
  primaryAction?: ReactNode;
  /** Optional slot rendered AFTER primaryAction (e.g. mobile-only 3-dot menu). */
  mobileExtra?: ReactNode;
  /** Where the back button navigates. Defaults to the agents list. */
  backHref?: string;
  /** Tooltip for the back button. Defaults to "Agents list". */
  backTooltip?: string;
}

export const EditTopBar = ({
  isLoading,
  mode,
  onModeToggle,
  modeToggleDisabled = false,
  rightAside,
  modeAction,
  primaryAction,
  mobileExtra,
  backHref = '/agent-builder/agents',
  backTooltip = 'Agents list',
}: EditTopBarProps) => {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4 md:px-10">
      <div className="justify-self-start">
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip={backTooltip}
          onClick={() => navigate(backHref, { viewTransition: true })}
        >
          <ArrowLeftIcon />
        </Button>
      </div>
      <AgentBuilderTitle
        className="min-w-0 justify-self-start"
        isLoading={isLoading}
        mode={mode}
        onModeToggle={onModeToggle}
        disabled={modeToggleDisabled}
      />
      <div className="justify-self-end flex items-center gap-2 shrink-0">
        {rightAside && <div className="shrink-0 mr-1">{rightAside}</div>}
        {modeAction && <div className="shrink-0">{modeAction}</div>}
        {primaryAction && <div className="shrink-0 flex">{primaryAction}</div>}
        {mobileExtra && <div className="shrink-0 lg:hidden">{mobileExtra}</div>}
      </div>
    </div>
  );
};
