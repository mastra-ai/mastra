import { AppSidebar } from './ui/app-sidebar';
import { MainSidebarProvider, NavigationCommand, Toaster, TooltipProvider } from '@mastra/playground-ui';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />

      <TooltipProvider delayDuration={0}>
        <MainSidebarProvider>
          <NavigationCommand />
          <div className="grid grid-cols-[auto_1fr] h-full">
            <AppSidebar />
            <div className="bg-surface2 my-3 mr-3 rounded-lg border border-border1 overflow-y-auto">{children}</div>
          </div>
        </MainSidebarProvider>
      </TooltipProvider>
    </div>
  );
};
