import { MainSidebarProvider } from '@mastra/playground-ui';
import { Outlet } from 'react-router';
import { AgentBuilderMobileBottomBar } from './agent-builder-mobile-bottom-bar';
import { AgentBuilderSidebar } from './agent-builder-sidebar';

export const AgentBuilderLayout = () => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <MainSidebarProvider>
        <div className="grid h-full grid-rows-1 md:grid-cols-[auto_1fr] md:divide-x md:divide-border1">
          <div className="hidden md:block">
            <AgentBuilderSidebar />
          </div>
          <div className="flex flex-col h-full min-h-0">
            <div className="flex-1 min-h-0 bg-transparent overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
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
    <div className="bg-surface1 font-sans h-screen grid grid-rows-1">
      <Outlet />
    </div>
  );
};
