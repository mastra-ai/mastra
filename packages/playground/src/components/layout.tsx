import { AuthRequired, MainSidebarProvider, NavigationCommand, Toaster, TooltipProvider } from '@mastra/playground-ui';
import { AppSidebar } from './ui/app-sidebar';
import { ThemeProvider } from './ui/theme-provider';
import { useLocation } from 'react-router';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  const usePageContent = [
    '/workflows',
    '/datasets',
    '/agents',
    '/prompts',
    '/processors',
    '/mcps',
    '/tools',
    '/scorers',
    '/templates',
  ].includes(pathname);

  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <MainSidebarProvider>
            <NavigationCommand />
            <div className="grid grid-cols-[auto_1fr] h-full">
              <AppSidebar />
              {usePageContent ? (
                <AuthRequired>{children}</AuthRequired>
              ) : (
                <div className="bg-surface2 my-3 mr-3 rounded-lg border border-border1 overflow-y-auto">
                  <AuthRequired>{children}</AuthRequired>
                </div>
              )}
            </div>
          </MainSidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
