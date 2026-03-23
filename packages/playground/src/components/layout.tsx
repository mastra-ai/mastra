import {
  AuthRequired,
  MainSidebarProvider,
  NavigationCommand,
  Toaster,
  TooltipProvider,
  useAuthCapabilities,
  isAuthenticated,
} from '@mastra/playground-ui';
import { cn } from '@/lib/utils';
import { AppSidebar } from './ui/app-sidebar';
import { ThemeProvider } from './ui/theme-provider';
import { useLocation } from 'react-router';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = isFetched && !shouldHideSidebar;
  const { pathname } = useLocation();
  const isMetrics = pathname === '/metrics';

  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <MainSidebarProvider>
            <NavigationCommand />
            <div className={shouldShowSidebar ? 'grid h-full grid-cols-[auto_1fr]' : 'h-full'}>
              {shouldShowSidebar && <AppSidebar />}
              <div
                className={cn('my-3 rounded-lg border border-border1 overflow-y-auto bg-surface2 mr-3', {
                  'border-t-none border-b-none border-r-none bg-transparent my-0 METRICS mr-0': isMetrics,
                  'h-[calc(100%-1.5rem)] mx-3': shouldHideSidebar,
                })}
              >
                <AuthRequired>{children}</AuthRequired>
              </div>
            </div>
          </MainSidebarProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
