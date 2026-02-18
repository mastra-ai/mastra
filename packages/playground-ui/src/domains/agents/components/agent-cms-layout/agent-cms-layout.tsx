import { AgentCmsSidebar } from '../agent-cms-sidebar';
import { AgentCmsBottomBar } from './agent-cms-bottom-bar';

interface AgentsCmsLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  basePath: string;
  versionId?: string;
}

export function AgentsCmsLayout({ children, currentPath, basePath, versionId }: AgentsCmsLayoutProps) {
  return (
    <div className="grid overflow-y-auto h-full bg-surface1 grid-cols-[240px_1fr]">
      <div className="overflow-y-auto h-full border-r border-border1">
        <AgentCmsSidebar basePath={basePath} currentPath={currentPath} versionId={versionId} />
      </div>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="overflow-y-auto flex-1 p-8 max-w-5xl w-full">{children}</div>
        <AgentCmsBottomBar basePath={basePath} currentPath={currentPath} />
      </div>
    </div>
  );
}
