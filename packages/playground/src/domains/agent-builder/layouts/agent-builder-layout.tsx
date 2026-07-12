import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { Outlet } from 'react-router';
import { AgentBuilderMobileBottomBar } from './agent-builder-mobile-bottom-bar';
import { AgentBuilderSidebar } from './agent-builder-sidebar';

export const AgentBuilderLayout = () => {
  return (
    <div className="h-screen bg-surface1 font-sans">
      <MainSidebarProvider>
        <div className="grid h-full grid-rows-1 md:grid-cols-[auto_1fr] md:divide-x md:divide-border1">
          <div className="hidden md:block">
            <AgentBuilderSidebar />
          </div>
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto bg-transparent pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
              <Outlet />
            </div>
          </div>
        </div>
        <AgentBuilderMobileBottomBar />
      </MainSidebarProvider>
    </div>
  );
};

export const AgentBuilderEditionLayout = () => {
  return (
    <div className="grid h-screen grid-cols-[minmax(0,1fr)] grid-rows-1 bg-surface1 font-sans">
      <Outlet />
    </div>
  );
};
