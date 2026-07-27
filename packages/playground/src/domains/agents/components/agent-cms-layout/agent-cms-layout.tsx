import { cn } from '@mastra/playground-ui/utils/cn';
import { AgentCmsSidebar } from '../agent-cms-sidebar';
import { AgentCmsBottomBar } from './agent-cms-bottom-bar';

interface AgentsCmsLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  basePath: string;
  versionId?: string;
  rightPanel?: React.ReactNode;
}

export function AgentsCmsLayout({ children, currentPath, basePath, versionId, rightPanel }: AgentsCmsLayoutProps) {
  return (
    <div
      className={cn(
        'grid overflow-y-auto h-full',
        rightPanel ? 'grid-cols-[240px_1fr_240px]' : 'grid-cols-[240px_1fr]',
      )}
    >
      <div className="border-border1 h-full overflow-y-auto border-r">
        <AgentCmsSidebar basePath={basePath} currentPath={currentPath} versionId={versionId} />
      </div>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="w-full max-w-5xl flex-1 overflow-y-auto p-8">{children}</div>
        <AgentCmsBottomBar basePath={basePath} currentPath={currentPath} />
      </div>
      {rightPanel && <div className="border-border1 h-full overflow-y-auto border-l">{rightPanel}</div>}
    </div>
  );
}
