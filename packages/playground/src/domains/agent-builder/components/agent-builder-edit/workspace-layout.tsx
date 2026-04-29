import { cn, IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AgentBuilderBreadcrumb } from './agent-builder-breadcrumb';

export type WorkspaceMode = 'build' | 'test';

interface WorkspaceLayoutProps {
  isLoading: boolean;
  mode: WorkspaceMode;
  creating?: boolean;
  modeAction?: ReactNode;
  primaryAction?: ReactNode;
  chat: ReactNode;
  configure: ReactNode;
  defaultExpanded?: boolean;
  detailOpen?: boolean;
  /** Optional browser modal overlay rendered outside the layout panels */
  browserOverlay?: ReactNode;
}

export const WorkspaceLayout = ({
  isLoading,
  mode,
  creating = false,
  modeAction,
  primaryAction,
  chat,
  configure,
  defaultExpanded = false,
  detailOpen = false,
  browserOverlay,
}: WorkspaceLayoutProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const gridClass = !expanded
    ? 'grid-cols-[1fr_0px] gap-0'
    : detailOpen
      ? 'grid-cols-[1fr_calc(50%-12px)] gap-6'
      : 'grid-cols-[1fr_320px] gap-6';
  const panelWidthClass = 'w-full';

  return (
    <div className="flex flex-1 min-w-0 flex-col h-full">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-6 pt-4">
        <div className="justify-self-start">
          <IconButton
            variant="ghost"
            tooltip="Agents list"
            onClick={() => navigate(`/agent-builder/agents`, { viewTransition: true })}
          >
            <ArrowLeftIcon />
          </IconButton>
        </div>
        <AgentBuilderBreadcrumb className="justify-self-center" isLoading={isLoading} mode={mode} creating={creating} />
        <div className="justify-self-end flex items-center gap-2">
          {modeAction}
          {primaryAction}
          <IconButton
            variant="ghost"
            tooltip={expanded ? 'Hide configuration' : 'Show configuration'}
            onClick={() => setExpanded(prev => !prev)}
            aria-pressed={expanded}
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
          </IconButton>
        </div>
      </div>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col px-6 pb-6 pt-4">
        <div className={cn('grid relative h-full min-h-0 agent-builder-panel-grid', gridClass)}>
          <div className="h-full w-full min-w-0 overflow-hidden">
            <div className="min-h-0 min-w-0 h-full overflow-hidden max-w-[80ch] mx-auto w-full">{chat}</div>
          </div>

          <div className="h-full min-w-0 overflow-hidden" aria-hidden={!expanded}>
            <div
              className={cn(
                'agent-builder-panel-slide h-full overflow-y-auto',
                panelWidthClass,
                expanded ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0 pointer-events-none',
              )}
              style={expanded ? { viewTransitionName: 'agent-builder-configure-panel' } : undefined}
            >
              {configure}
            </div>
          </div>
        </div>
      </div>
      {browserOverlay}
    </div>
  );
};
