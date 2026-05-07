import {
  ErrorBoundary,
  LogoWithoutText,
  MainSidebar,
  MainSidebarProvider,
  ThemeProvider,
  Toaster,
  TooltipProvider,
} from '@mastra/playground-ui';
import { useLocation } from 'react-router';
import { AppSidebar } from './ui/app-sidebar';
import { AuthRequired } from '@/domains/auth/components/auth-required';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';
import { ExperimentalUIProvider } from '@/domains/experimental-ui/experimental-ui-context';
import { UI_EXPERIMENTS } from '@/domains/experimental-ui/experiments';
import { useExperimentalUIEnabled } from '@/domains/experimental-ui/use-experimental-ui-enabled';
import { NavigationCommand } from '@/lib/command';
import { cn } from '@/lib/utils';

function MobileNavbar() {
  return (
    <header className="lg:hidden sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-border1 bg-surface1 px-3">
      <MainSidebar.MobileTrigger />
      <span className="flex items-center gap-2">
        <LogoWithoutText className="h-[1.5rem] w-[1.5rem] shrink-0" />
        <span className="font-serif text-sm whitespace-nowrap">Mastra Studio</span>
      </span>
    </header>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { data: authCapabilities, isFetched } = useAuthCapabilities();
  const { pathname } = useLocation();
  const shouldHideSidebar = isFetched && authCapabilities?.enabled && !isAuthenticated(authCapabilities);
  const shouldShowSidebar = isFetched && !shouldHideSidebar;

  const content = (
    <AuthRequired>
      <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>
    </AuthRequired>
  );

  return (
    <>
      <NavigationCommand />
      <div className={cn('h-full', shouldShowSidebar && 'lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]')}>
        {shouldShowSidebar && <AppSidebar />}
        <div className="flex flex-col h-full min-h-0">
          {shouldShowSidebar && <MobileNavbar />}
          <div
            className={cn('flex-1 min-h-0 bg-transparent overflow-y-auto', {
              'h-[calc(100%-1.5rem)]': !shouldShowSidebar && shouldHideSidebar,
            })}
          >
            {content}
          </div>
        </div>
      </div>
    </>
  );
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const { experimentalUIEnabled } = useExperimentalUIEnabled();

  return (
    <div className="bg-surface1 font-sans h-screen">
      <Toaster position="bottom-right" />
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider delayDuration={0}>
          <ExperimentalUIProvider experiments={experimentalUIEnabled ? UI_EXPERIMENTS : []}>
            <MainSidebarProvider>
              <LayoutContent>{children}</LayoutContent>
            </MainSidebarProvider>
          </ExperimentalUIProvider>
        </TooltipProvider>
      </ThemeProvider>
    </div>
  );
};
