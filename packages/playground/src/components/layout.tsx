import {
  AuthRequired,
  ExperimentalUIProvider,
  MainSidebarProvider,
  NavigationCommand,
  Toaster,
  TooltipProvider,
  useAuthCapabilities,
  isAuthenticated,
} from '@mastra/playground-ui';
import { AppSidebar } from './ui/app-sidebar';
import { ThemeProvider } from './ui/theme-provider';
import { EXPERIMENTS } from '@/domains/experimental-ui/experiments';

function LayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr] h-full">
      <AppSidebar />
      <div className="border-l border-border1 overflow-y-auto">
        <AuthRequired>{children}</AuthRequired>
      </div>
    </div>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = isFetched && !shouldHideSidebar;

  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark" attribute="class">
        <TooltipProvider delayDuration={0}>
          <ExperimentalUIProvider experiments={EXPERIMENTS}>
            <MainSidebarProvider>
              <NavigationCommand />
              <div className={shouldShowSidebar ? 'grid h-full grid-cols-[auto_1fr]' : 'h-full'}>
                {shouldShowSidebar && <AppSidebar />}
                <div
                  className={`bg-surface2 my-3 rounded-lg border border-border1 overflow-y-auto ${
                    shouldHideSidebar ? 'h-[calc(100%-1.5rem)] mx-3' : 'mr-3'
                  }`}
                >
                  <AuthRequired>{children}</AuthRequired>
                </div>
              </div>
            </MainSidebarProvider>
          </ExperimentalUIProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
