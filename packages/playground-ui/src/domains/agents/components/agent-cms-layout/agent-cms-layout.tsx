import { AgentCmsSidebar } from '../agent-cms-sidebar';

interface AgentsCmsLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  basePath: string;
}

export function AgentsCmsLayout({ children, currentPath, basePath }: AgentsCmsLayoutProps) {
  return (
    <div className="grid overflow-y-auto h-full bg-surface1 grid-cols-[240px_1fr]">
      <div className="overflow-y-auto h-full border-r border-border1 bg-surface2">
        <AgentCmsSidebar basePath={basePath} currentPath={currentPath} />
      </div>
      <div className="overflow-y-auto h-full py-4">{children}</div>
    </div>
  );
}
