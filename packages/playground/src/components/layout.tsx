import {
  AuthRequired,
  MainSidebarProvider,
  NavigationCommand,
  Toaster,
  TooltipProvider,
  useAuthCapabilities,
  isAuthenticated,
} from '@mastra/playground-ui';
import { AppSidebar } from './ui/app-sidebar';
import { ThemeProvider } from './ui/theme-provider';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { data: authCapabilities } = useAuthCapabilities();
  const shouldHideSidebar = authCapabilities?.enabled && !isAuthenticated(authCapabilities);

  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <MainSidebarProvider>
            <NavigationCommand />
            <div className={shouldHideSidebar ? 'h-full' : 'grid h-full grid-cols-[auto_1fr]'}>
              {!shouldHideSidebar && <AppSidebar />}
              <div
                className={`bg-surface2 my-3 rounded-lg border border-border1 overflow-y-auto ${
                  shouldHideSidebar ? 'h-[calc(100%-1.5rem)] mx-3' : 'mr-3'
                }`}
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
