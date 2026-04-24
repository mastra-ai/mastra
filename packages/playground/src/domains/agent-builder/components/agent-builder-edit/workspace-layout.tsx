import { cn, IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon, Columns2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AgentBuilderBreadcrumb } from './agent-builder-breadcrumb';

export type WorkspaceMode = 'build' | 'test';

interface WorkspaceLayoutProps {
  isLoading: boolean;
  mode: WorkspaceMode;
  modeAction?: ReactNode;
  primaryAction?: ReactNode;
  chat: ReactNode;
  configure: ReactNode;
  defaultExpanded?: boolean;
}

export const WorkspaceLayout = ({
  isLoading,
  mode,
  modeAction,
  primaryAction,
  chat,
  configure,
  defaultExpanded = false,
}: WorkspaceLayoutProps) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const gridClass = expanded ? 'grid-cols-[1fr_380px] gap-6' : 'grid-cols-[1fr_0px] gap-0';

  return (
    <div className="flex flex-1 min-w-0 flex-col h-full">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-6 pt-4">
        <div className="justify-self-start">
          <IconButton tooltip="Agents list" className="rounded-full" onClick={() => navigate(`/agent-builder/agents`)}>
            <ArrowLeftIcon />
          </IconButton>
        </div>
        <AgentBuilderBreadcrumb className="justify-self-center" isLoading={isLoading} mode={mode} />
        <div className="justify-self-end flex items-center gap-2">
          {modeAction}
          <IconButton
            tooltip={expanded ? 'Hide configuration' : 'Show configuration'}
            className="rounded-full"
            onClick={() => setExpanded(prev => !prev)}
          >
            <Columns2 />
          </IconButton>
          {primaryAction}
        </div>
      </div>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col px-6 pb-6 pt-4">
        <div className={cn('grid relative h-full min-h-0 agent-builder-panel-grid', gridClass)}>
          <div className="h-full w-full min-w-0 overflow-hidden">
            <div className="min-h-0 min-w-0 h-full overflow-hidden max-w-[80ch] mx-auto w-full">{chat}</div>
          </div>

          <div
            className="h-full min-w-0 overflow-hidden"
            aria-hidden={!expanded}
          >
            <div
              className={cn(
                'agent-builder-panel-slide h-full w-[380px] overflow-y-auto',
                expanded ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0 pointer-events-none',
              )}
              style={expanded ? { viewTransitionName: 'agent-builder-configure-panel' } : undefined}
            >
              {configure}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
