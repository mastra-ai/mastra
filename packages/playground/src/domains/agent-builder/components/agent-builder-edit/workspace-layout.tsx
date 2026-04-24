import { cn, IconButton } from '@mastra/playground-ui';
import { ArrowLeftIcon, Columns2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AgentBuilderBreadcrumb } from './agent-builder-breadcrumb';
import { BrowserFrame } from '@/domains/agent-builder/components/browser-frame';

interface WorkspaceLayoutProps {
  isLoading: boolean;
  toolbarAction?: ReactNode;
  chat: ReactNode;
  configure: ReactNode;
  defaultExpanded?: boolean;
}

export const WorkspaceLayout = ({
  isLoading,
  toolbarAction,
  chat,
  configure,
  defaultExpanded = true,
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
        <AgentBuilderBreadcrumb className="justify-self-center" isLoading={isLoading} />
        <div className="justify-self-end">
          <IconButton
            tooltip={expanded ? 'Hide configuration' : 'Show configuration'}
            className="rounded-full"
            onClick={() => setExpanded(prev => !prev)}
          >
            <Columns2 />
          </IconButton>
        </div>
      </div>
      <div className="flex flex-1 min-h-0 min-w-0 flex-col px-6 pb-6 pt-4">
        <div className={cn('grid relative h-full min-h-0 agent-builder-panel-grid', gridClass)}>
          <BrowserFrame>
            <div className="h-full w-full min-w-0 overflow-hidden grid grid-rows-[auto_1fr]">
              <div className="flex gap-2 items-center pl-6 pt-6 pr-6">{toolbarAction}</div>
              <div className="min-h-0 min-w-0 overflow-hidden pb-6 max-w-[80ch] mx-auto w-full">{chat}</div>
            </div>
          </BrowserFrame>

          <div className="h-full min-w-0 overflow-hidden bg-surface2 rounded-3xl" aria-hidden={!expanded}>
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
