import { MainSidebarProvider } from '@mastra/playground-ui';
import { AgentBuilderSidebar } from './agent-builder-sidebar';

export const AgentBuilderLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <MainSidebarProvider>
        <div className="grid h-full grid-cols-[auto_1fr] divide-x divide-border1">
          <AgentBuilderSidebar />
          <div className="bg-transparent overflow-y-auto">{children}</div>
        </div>
      </MainSidebarProvider>
    </div>
  );
};
