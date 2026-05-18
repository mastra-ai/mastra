import { Button, cn } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AgentBuilderTitle } from '../components/agent-edit/agent-builder-title';

export type WorkspaceMode = 'build' | 'test';

interface WorkspaceLayoutProps {
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
  chat: ReactNode;
  /**
   * Optional configure pane. When provided, it renders side-by-side with the
   * chat in a 50/50 grid on desktop and stacks below the chat on mobile.
   * When omitted, the chat fills the whole workspace.
   */
  configure?: ReactNode;
  /** Optional browser modal overlay rendered outside the layout panels */
  browserOverlay?: ReactNode;
  /** Where the back button navigates. Defaults to the agents list. */
  backHref?: string;
  /** Tooltip for the back button. Defaults to "Agents list". */
  backTooltip?: string;
}

export const WorkspaceLayout = ({
  isLoading,
  mode,
  onModeToggle,
  modeToggleDisabled = false,
  rightAside,
  modeAction,
  primaryAction,
  mobileExtra,
  chat,
  configure,
  browserOverlay,
  backHref = '/agent-builder/agents',
  backTooltip = 'Agents list',
}: WorkspaceLayoutProps) => {
  const navigate = useNavigate();
  const hasConfigure = configure !== undefined && configure !== null;

  return (
    <div className="flex flex-1 min-w-0 flex-col h-full min-h-0">
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

      <div
        className={cn(
          'flex flex-1 min-h-0 min-w-0 flex-col py-6',
          hasConfigure && 'lg:grid lg:grid-rows-1 lg:grid-cols-2',
        )}
      >
        <div className="flex flex-1 min-h-0 min-w-0 flex-col px-4 md:px-10 lg:overflow-hidden">
          <div className="h-full w-full min-w-0 overflow-hidden" data-testid="agent-builder-panel-chat">
            <div className="min-h-0 min-w-0 h-full overflow-hidden md:max-w-[80ch] md:mx-auto w-full">{chat}</div>
          </div>
        </div>

        {hasConfigure && (
          <div
            className={cn(
              'min-w-0 overflow-hidden',
              // Mobile: stacked below the chat with normal page padding.
              'flex-1 px-4 md:px-10',
              // Desktop: full-height sibling column with right-edge padding so
              // the rounded panel doesn't kiss the viewport edge.
              'lg:flex-none lg:h-full lg:min-h-0 lg:pl-0 lg:pr-10',
            )}
            data-testid="agent-builder-panel-configure"
          >
            <div className="h-full min-h-0 w-full min-w-0 overflow-hidden">{configure}</div>
          </div>
        )}
      </div>

      {browserOverlay}
    </div>
  );
};
