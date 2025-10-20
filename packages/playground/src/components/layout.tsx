import { AppSidebar } from './ui/app-sidebar';
import { Toaster } from './ui/sonner';
import { ThemeProvider } from './ui/theme-provider';
import { MainSidebarProvider, TooltipProvider } from '@mastra/playground-ui';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <div className="grid grid-cols-[auto_1fr] h-full">
            <MainSidebarProvider>
              <AppSidebar />
            </MainSidebarProvider>
            <div className="bg-surface2 my-3 mr-3 rounded-lg border-sm border-border1 overflow-y-auto">{children}</div>
          </div>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
