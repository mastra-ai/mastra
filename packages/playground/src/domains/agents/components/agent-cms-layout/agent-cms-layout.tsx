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
        'grid h-full min-w-0 grid-cols-1 overflow-y-auto',
        rightPanel ? 'lg:grid-cols-[240px_minmax(0,1fr)_240px]' : 'lg:grid-cols-[240px_minmax(0,1fr)]',
      )}
    >
      <div className="border-border1 min-w-0 overflow-y-auto border-b lg:h-full lg:border-r lg:border-b-0">
        <AgentCmsSidebar basePath={basePath} currentPath={currentPath} versionId={versionId} />
      </div>
      <div className="flex min-w-0 flex-col overflow-hidden lg:h-full">
        <div className="w-full max-w-5xl flex-1 overflow-y-auto p-8">{children}</div>
        <AgentCmsBottomBar basePath={basePath} currentPath={currentPath} />
      </div>
      {rightPanel && (
        <div className="border-border1 min-w-0 overflow-y-auto border-t lg:h-full lg:border-t-0 lg:border-l">
          {rightPanel}
        </div>
      )}
    </div>
  );
}
