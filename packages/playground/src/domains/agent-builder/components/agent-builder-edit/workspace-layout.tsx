import { Button, cn } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AgentBuilderTitle } from './agent-builder-title';

export type WorkspaceMode = 'build' | 'test';

type ActiveTab = 'chat' | 'configure';

interface WorkspaceLayoutProps {
  isLoading: boolean;
  mode: WorkspaceMode;
  creating?: boolean;
  modeAction?: ReactNode;
  primaryAction?: ReactNode;
  /** Optional slot rendered AFTER primaryAction (e.g. mobile-only 3-dot menu). */
  mobileExtra?: ReactNode;
  chat: ReactNode;
  configure: ReactNode;
  defaultExpanded?: boolean;
  detailOpen?: boolean;
  /** Whether the configure panel/tab should be shown. Defaults to true. */
  showConfigure?: boolean;
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
  creating = false,
  modeAction,
  primaryAction,
  mobileExtra,
  chat,
  configure,
  defaultExpanded = false,
  detailOpen = false,
  showConfigure = true,
  browserOverlay,
  backHref = '/agent-builder/agents',
  backTooltip = 'Agents list',
}: WorkspaceLayoutProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

  // On lg+, the entire main column (header + chat) shrinks/pushes left when
  // the configure panel is open. The configure panel is a full-height sibling
  // column with no padding so it spans edge to edge.
  const workspaceGridClass =
    showConfigure && expanded
      ? detailOpen
        ? 'lg:grid-cols-[1fr_calc(50%-12px)]'
        : 'lg:grid-cols-[1fr_320px]'
      : 'lg:grid-cols-[1fr_0px]';

  return (
    <div
      className={cn(
        'flex flex-1 min-w-0 flex-col h-full',
        'lg:grid lg:grid-rows-1 agent-builder-workspace-grid',
        workspaceGridClass,
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col h-full lg:h-auto lg:min-h-0 lg:overflow-hidden',
          // On mobile, when activeTab === 'configure' the chat panel is hidden;
          // shrink this column so the configure sibling can claim the space.
          activeTab === 'configure' ? 'flex-none' : 'flex-1',
          'lg:flex-1',
        )}
      >
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
            creating={creating}
          />
          <div className="justify-self-end flex items-center gap-2 shrink-0">
            {modeAction && <div className="shrink-0">{modeAction}</div>}
            {primaryAction && <div className="shrink-0 flex">{primaryAction}</div>}
            {mobileExtra && <div className="shrink-0 lg:hidden">{mobileExtra}</div>}
            {showConfigure && (
              <div className="shrink-0 hidden lg:inline-flex">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  tooltip={expanded ? 'Hide configuration' : 'Show configuration'}
                  onClick={() => setExpanded(prev => !prev)}
                  aria-pressed={expanded}
                  className="shrink-0"
                >
                  <div
                    className={cn(
                      'size-4 border border-current rounded-md grid divide-x divide-current transition-all duration-200 ease-out overflow-hidden',
                      expanded ? 'grid-cols-[1fr_40%]' : 'grid-cols-[1fr_10%]',
                    )}
                  >
                    <div />
                    <div className="bg-neutral1 h-full w-full" />
                  </div>
                </Button>
              </div>
            )}
          </div>
        </div>
        {showConfigure && (
          <div className="lg:hidden px-4 py-4 md:px-10 md:py-5">
            <div
              role="tablist"
              aria-label="Workspace view"
              className="relative mx-auto flex h-9 w-full max-w-sm items-center rounded-full border border-border1 bg-surface3 p-0.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-surface4',
                  'transition-transform duration-200 ease-out',
                  activeTab === 'configure' && 'translate-x-full',
                )}
              />
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'chat'}
                data-testid="agent-builder-tab-chat"
                onClick={() => setActiveTab('chat')}
                className={cn(
                  'relative z-10 flex-1 rounded-full text-ui-md font-medium outline-none',
                  'transition-colors duration-200',
                  activeTab === 'chat' ? 'text-neutral5' : 'text-neutral3 hover:text-neutral4',
                )}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'configure'}
                data-testid="agent-builder-tab-configure"
                onClick={() => setActiveTab('configure')}
                className={cn(
                  'relative z-10 flex-1 rounded-full text-ui-md font-medium outline-none',
                  'transition-colors duration-200',
                  activeTab === 'configure' ? 'text-neutral5' : 'text-neutral3 hover:text-neutral4',
                )}
              >
                Configuration
              </button>
            </div>
          </div>
        )}
        <div className="flex flex-1 min-h-0 min-w-0 flex-col px-4 pb-6 pt-4 md:px-10">
          <div
            className="h-full w-full min-w-0 overflow-hidden data-[active-tab=configure]:hidden lg:!block"
            data-active-tab={activeTab}
            data-testid="agent-builder-panel-chat"
          >
            <div className="min-h-0 min-w-0 h-full overflow-hidden md:max-w-[80ch] md:mx-auto w-full">{chat}</div>
          </div>
        </div>
      </div>

      {/*
       * Configure panel:
       * - On lg+, it is a full-height sibling column of the main content.
       *   Toggling expanded slides it in/out.
       * - On <lg, it is a tab-switched pane that occupies the area below the
       *   header/tabs, replacing the chat panel when activeTab === 'configure'.
       *   We use data-active-tab and CSS to hide it when activeTab !== 'configure'.
       */}
      {showConfigure && (
        <div
          className={cn(
            'min-w-0 overflow-hidden',
            // Mobile: occupy the full main area below header/tabs when active.
            // The chat panel hides itself when activeTab === 'configure' so the
            // outer column has free space; we fill it via flex-1 and px padding
            // matching the main column.
            'flex-1 px-4 pb-6 md:px-10 data-[active-tab=chat]:hidden',
            // Desktop: full-height sibling column, no padding (edge-to-edge),
            // always rendered (visibility/translate handled via expanded).
            'lg:flex-none lg:h-full lg:px-0 lg:pb-0 lg:!block',
          )}
          data-active-tab={activeTab}
          data-testid="agent-builder-panel-configure"
          aria-hidden={!expanded}
        >
          <div
            className={cn(
              'agent-builder-panel-slide h-full w-full overflow-y-auto',
              // Mobile: always fully visible when this pane is active.
              'translate-x-0 opacity-100',
              // Desktop: slide in/out based on expanded.
              'lg:transition-all',
              expanded ? 'lg:translate-x-0 lg:opacity-100' : 'lg:translate-x-4 lg:opacity-0 lg:pointer-events-none',
            )}
            style={expanded ? { viewTransitionName: 'agent-builder-configure-panel' } : undefined}
          >
            {configure}
          </div>
        </div>
      )}

      {browserOverlay}
    </div>
  );
};
