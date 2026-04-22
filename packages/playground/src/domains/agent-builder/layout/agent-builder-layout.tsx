import { MainSidebarProvider } from '@mastra/playground-ui';
import { Outlet } from 'react-router';
import { AgentBuilderSidebar } from './agent-builder-sidebar';

export const AgentBuilderLayout = () => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <MainSidebarProvider>
        <div className="grid h-full grid-cols-[auto_1fr] divide-x divide-border1">
          <AgentBuilderSidebar />
          <div className="bg-transparent overflow-y-auto">
            <Outlet />
          </div>
        </div>
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
