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
    // Below `md` the fixed side columns no longer fit beside the form, so the three areas stack and the page scrolls.
    <div
      className={cn(
        'grid h-full grid-cols-1 overflow-y-auto',
        rightPanel ? 'md:grid-cols-[240px_1fr_240px]' : 'md:grid-cols-[240px_1fr]',
      )}
    >
      <div className="border-b border-border md:h-full md:overflow-y-auto md:border-r md:border-b-0">
        <AgentCmsSidebar basePath={basePath} currentPath={currentPath} versionId={versionId} />
      </div>
      <div className="flex min-w-0 flex-col md:h-full md:overflow-hidden">
        <div className="w-full max-w-5xl flex-1 p-5 md:overflow-y-auto">{children}</div>
        <AgentCmsBottomBar basePath={basePath} currentPath={currentPath} />
      </div>
      {rightPanel && (
        <div className="border-t border-border md:h-full md:overflow-y-auto md:border-t-0 md:border-l">
          {rightPanel}
        </div>
      )}
    </div>
  );
}
